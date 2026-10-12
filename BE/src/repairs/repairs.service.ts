import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineInventoryStatus,
  MachineStatus,
  OperationalCreatedSource,
  OperationalDataStatus,
  MachineProductCategory,
  Prisma,
  RepairPriority,
  RepairStatus,
  WorkReviewStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { isAdmin, isEngineer, repairAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { DeleteWorkTaskDto } from '../common/dto/delete-work-task.dto';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import {
  buildDeleteRequestNote,
  deleteRequestDisplayNote,
  isApprovedDeleteReview,
  isDeleteRequest,
} from '../common/work-delete-request';
import { assertNoPendingDeleteRequest, assertTicketCanBeDeleted } from '../common/pending-delete-request';
import { reconcileMachineStatusFromOpenWork } from '../common/machine-work-status';
import { replaceWorkUsedParts } from '../common/work-used-parts';
import { shortDateCode } from '../common/code-format';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import {
  getMachineStatusAfterWork,
  validateMachineState,
} from '../machines/machine-state.rules';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRepairDto } from './dto/assign-repair.dto';
import { CreateRepairDto } from './dto/create-repair.dto';
import { ListRepairsQueryDto } from './dto/list-repairs-query.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairDto } from './dto/update-repair.dto';

type MachineExpertiseSource = {
  businessLine?: {
    expertiseGroup?: string | null;
    productIndustry?: {
      expertiseGroup?: string | null;
    } | null;
  } | null;
  machineModel?: {
    businessLine?: {
      expertiseGroup?: string | null;
      productIndustry?: {
        expertiseGroup?: string | null;
      } | null;
    } | null;
  } | null;
} | null;

@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateRepairDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.REPAIR_CREATE);
    const selfSubmission = isEngineer(actor);
    if (!isAdmin(actor) && !selfSubmission)
      throw new ForbiddenException(
        'Only administrators or engineers can create repair tickets',
      );
    this.validateCreateRepair(dto);

    const machine = dto.machineId
      ? await this.ensureMachineExists(dto.machineId)
      : null;
    if (machine) {
      await this.assertEngineerCanUseMachine(actor, machine);
    }

    const engineerIds = selfSubmission ? [actor.id] : [
      ...new Set(
        dto.engineerIds?.length
          ? dto.engineerIds
          : dto.engineerId
            ? [dto.engineerId]
            : [],
      ),
    ];
    if (!engineerIds.length)
      throw new BadRequestException('At least one engineer must be assigned');
    await Promise.all(
      engineerIds.map((engineerId) => this.ensureEngineerExists(engineerId)),
    );
    const engineerId = engineerIds[0];
    const customerId = await this.resolveTicketCustomerId(
      machine,
      dto.customerId,
    );
    if (
      selfSubmission &&
      (!machine || !customerId || !dto.description?.trim() ||
        !dto.repairMethod?.trim() || !dto.resultNote?.trim())
    ) {
      throw new BadRequestException(
        'Engineer-submitted repair reports require a customer, machine, problem description, repair method, and result',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const repair = await tx.repair.create({
          data: {
            code: await this.generateRepairCode(
              tx,
              this.parseOptionalDate(dto.reportedAt) ?? new Date(),
            ),
            title: dto.title?.trim() || 'Phiếu sửa chữa',
            description: dto.description?.trim() || null,
            machineId: machine?.id ?? null,
            customerId,
            engineerId: engineerId || null,
            createdById: actor.id,
            priority: dto.priority ?? RepairPriority.NORMAL,
            status: selfSubmission ? RepairStatus.COMPLETED : RepairStatus.ASSIGNED,
            reportedAt: this.parseOptionalDate(dto.reportedAt) ?? new Date(),
            assignedAt: engineerId ? new Date() : null,
            completedAt: selfSubmission ? new Date() : null,
            reviewStatus: selfSubmission ? WorkReviewStatus.PENDING : WorkReviewStatus.NOT_REQUIRED,
            resultNote: this.cleanOptionalString(dto.resultNote),
            customerFeedback: this.cleanOptionalString(dto.customerFeedback),
            usingDepartment: this.cleanOptionalString(dto.usingDepartment),
            representative: this.cleanOptionalString(dto.representative),
            representativePosition: this.cleanOptionalString(
              dto.representativePosition,
            ),
            address: this.cleanOptionalString(dto.address),
            contactPhone: this.cleanOptionalString(dto.contactPhone),
            deviceName: this.cleanOptionalString(dto.deviceName),
            modelName: this.cleanOptionalString(dto.modelName),
            serialNumber: this.cleanOptionalString(dto.serialNumber),
            warrantyStatus: this.cleanOptionalString(dto.warrantyStatus),
            warrantyTerm: this.cleanOptionalString(dto.warrantyTerm),
            receivedAccessories: this.cleanOptionalString(
              dto.receivedAccessories,
            ),
            preliminaryCause: this.cleanOptionalString(dto.preliminaryCause),
            conditionAssessment: this.cleanOptionalString(
              dto.conditionAssessment,
            ),
            repairMethod: this.cleanOptionalString(dto.repairMethod),
            repairCostItems: this.cleanOptionalString(dto.repairCostItems),
            totalRepairCost: this.cleanOptionalString(dto.totalRepairCost),
            repairCostInWords: this.cleanOptionalString(dto.repairCostInWords),
          },
          include: this.defaultInclude(),
        });

        await tx.repairAssignment.createMany({
          data: engineerIds.map((assignedEngineerId, index) => ({
            repairId: repair.id,
            engineerId: assignedEngineerId,
            isLead: index === 0,
          })),
        });

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.CREATE,
            entityType: 'Repair',
            entityId: repair.id,
            actor,
            metadata: {
              code: repair.code,
              machineId: repair.machineId,
              customerId: repair.customerId,
              createdById: repair.createdById,
              engineerId: repair.engineerId,
              status: repair.status,
            },
          },
          tx,
        );

        if (selfSubmission) {
          await this.notificationsService.createForAdmins({
            title: 'Phiếu sửa chữa chờ phê duyệt',
            message: `Phiếu sửa chữa ${repair.code} đã được trình phê duyệt.`,
            href: '/service-tickets',
            entityType: 'Repair',
            entityId: repair.id,
            createdById: actor.id,
          }, tx);
        } else await Promise.all(
          engineerIds.map((assignedEngineerId) =>
            this.notificationsService.create(
              {
                userId: assignedEngineerId,
                title: 'Phiếu sửa chữa mới được phân công',
                message: `Phiếu ${repair.code} đã được phân công: ${repair.title}`,
                href: '/my-tasks',
                entityType: 'Repair',
                entityId: repair.id,
                createdById: actor.id,
              },
              tx,
            ),
          ),
        );

        return tx.repair.findUnique({
          where: { id: repair.id },
          include: this.defaultInclude(),
        });
      },
      { timeout: 20_000 },
    );
  }

  async findAll(
    query: ListRepairsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.repair.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [
          { createdAt: 'desc' },
          { updatedAt: 'desc' },
          { reportedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.repair.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const repair = await this.prisma.repair.findFirst({
      where: this.withAccessScope({ id }, user),
      include: this.defaultInclude(),
    });

    if (!repair) {
      throw new NotFoundException('Repair not found');
    }

    return repair;
  }

  async update(id: string, dto: UpdateRepairDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.REPAIR_UPDATE);
    const repair = await this.findOne(id, actor);
    assertNoPendingDeleteRequest(repair);
    const nextEngineerId =
      dto.engineerId === undefined ? repair.engineerId : dto.engineerId || null;
    const nextStatus = dto.status ?? repair.status;
    const nextMachine =
      dto.machineId === undefined
        ? repair.machine
        : dto.machineId
          ? await this.ensureMachineExists(dto.machineId)
          : null;
    const nextCustomerId = await this.resolveTicketCustomerId(
      nextMachine,
      dto.customerId === undefined
        ? dto.machineId === undefined
          ? repair.customerId
          : (nextMachine?.customerId ?? null)
        : dto.customerId,
    );

    if (nextMachine) {
      await this.assertEngineerCanUseMachine(
        actor,
        nextMachine as MachineExpertiseSource,
      );
    }

    if (nextEngineerId) {
      await this.ensureEngineerExists(nextEngineerId);
    }

    this.ensureStatusTransitionIsAllowed(repair.status, nextStatus);

    if (this.statusRequiresEngineer(nextStatus) && !nextEngineerId) {
      throw new BadRequestException(
        'Repair must be assigned to an engineer first',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: {
            title: dto.title?.trim(),
            description:
              dto.description === undefined
                ? undefined
                : dto.description?.trim() || null,
            priority: dto.priority,
            engineerId:
              dto.engineerId === undefined ? undefined : nextEngineerId,
            machineId:
              dto.machineId === undefined
                ? undefined
                : (nextMachine?.id ?? null),
            customerId:
              dto.customerId === undefined && dto.machineId === undefined
                ? undefined
                : nextCustomerId,
            status: dto.status,
            assignedAt:
              dto.engineerId !== undefined &&
              nextEngineerId &&
              !repair.assignedAt
                ? new Date()
                : undefined,
            startedAt:
              dto.status === RepairStatus.IN_PROGRESS && !repair.startedAt
                ? new Date()
                : undefined,
            completedAt:
              dto.status === RepairStatus.COMPLETED ? new Date() : undefined,
            reviewStatus: dto.status
              ? this.resolveReviewStatus(dto.status, actor)
              : undefined,
            reviewedAt:
              dto.status === RepairStatus.COMPLETED && isAdmin(actor)
                ? new Date()
                : dto.status
                  ? null
                  : undefined,
            reviewerId:
              dto.status === RepairStatus.COMPLETED && isAdmin(actor)
                ? actor.id
                : dto.status
                  ? null
                  : undefined,
            resultNote:
              dto.resultNote === undefined
                ? undefined
                : dto.resultNote?.trim() || null,
            customerFeedback:
              dto.customerFeedback === undefined
                ? undefined
                : dto.customerFeedback?.trim() || null,
            usingDepartment: this.cleanOptionalUpdateString(
              dto.usingDepartment,
            ),
            representative: this.cleanOptionalUpdateString(dto.representative),
            representativePosition: this.cleanOptionalUpdateString(
              dto.representativePosition,
            ),
            address: this.cleanOptionalUpdateString(dto.address),
            contactPhone: this.cleanOptionalUpdateString(dto.contactPhone),
            deviceName: this.cleanOptionalUpdateString(dto.deviceName),
            modelName: this.cleanOptionalUpdateString(dto.modelName),
            serialNumber: this.cleanOptionalUpdateString(dto.serialNumber),
            warrantyStatus: this.cleanOptionalUpdateString(dto.warrantyStatus),
            warrantyTerm: this.cleanOptionalUpdateString(dto.warrantyTerm),
            receivedAccessories: this.cleanOptionalUpdateString(
              dto.receivedAccessories,
            ),
            preliminaryCause: this.cleanOptionalUpdateString(
              dto.preliminaryCause,
            ),
            conditionAssessment: this.cleanOptionalUpdateString(
              dto.conditionAssessment,
            ),
            repairMethod: this.cleanOptionalUpdateString(dto.repairMethod),
            repairCostItems: this.cleanOptionalUpdateString(
              dto.repairCostItems,
            ),
            totalRepairCost: this.cleanOptionalUpdateString(
              dto.totalRepairCost,
            ),
            repairCostInWords: this.cleanOptionalUpdateString(
              dto.repairCostInWords,
            ),
          },
          include: this.defaultInclude(),
        });

        // Register/link the repaired unit only after an administrator accepts
        // completion. A manually entered serial can identify or create its
        // machine record here.
        if (
          nextStatus === RepairStatus.COMPLETED &&
          updated.reviewStatus === WorkReviewStatus.APPROVED &&
          updated.customerId
        ) {
          await this.ensureCompletedRepairMachine(
            tx,
            updated.id,
            actor,
            updated.machineId,
            updated.customerId,
            updated.serialNumber,
            updated.modelName,
            updated.deviceName,
          );
        }

        let machineStatus = this.getMachineStatusForRepairStatus(
          nextStatus,
          nextMachine?.inventoryStatus,
        );

        if (machineStatus && nextMachine) {
          if (
            nextStatus === RepairStatus.COMPLETED ||
            nextStatus === RepairStatus.CANCELLED
          ) {
            machineStatus = await reconcileMachineStatusFromOpenWork(
              tx,
              nextMachine.id,
              nextMachine.inventoryStatus,
            );
          } else {
            validateMachineState(
              machineStatus,
              nextMachine.inventoryStatus,
              nextMachine.customerId,
            );
            await tx.machine.update({
              where: { id: nextMachine.id },
              data: { status: machineStatus },
            });
          }
        }

        if (repair.machine && repair.machine.id !== nextMachine?.id) {
          await reconcileMachineStatusFromOpenWork(
            tx,
            repair.machine.id,
            repair.machine.inventoryStatus,
          );
        }

        if (dto.usedParts !== undefined) {
          await replaceWorkUsedParts({
            actor,
            customerId: updated.customerId,
            machineId: updated.machineId,
            owner: { field: 'repairId', id: updated.id, kind: 'REPAIR' },
            parts: dto.usedParts,
            prisma: this.prisma,
            tx,
          });
        }

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.UPDATE,
            entityType: 'Repair',
            entityId: id,
            actor,
            changes: this.pickChangedFields(repair, updated, [
              'title',
              'description',
              'priority',
              'customerId',
              'engineerId',
              'status',
              'resultNote',
              'customerFeedback',
              'usingDepartment',
              'representative',
              'representativePosition',
              'address',
              'contactPhone',
              'deviceName',
              'modelName',
              'serialNumber',
              'warrantyStatus',
              'warrantyTerm',
              'receivedAccessories',
              'preliminaryCause',
              'conditionAssessment',
              'repairMethod',
              'repairCostItems',
              'totalRepairCost',
              'repairCostInWords',
            ]),
          },
          tx,
        );

        if (updated.engineerId && updated.engineerId !== repair.engineerId) {
          await this.notificationsService.create(
            {
              userId: updated.engineerId,
              title: 'Phiếu sửa chữa mới được phân công',
              message: `Phiếu ${updated.code} đã được phân công: ${updated.title}`,
              href: '/my-tasks',
              entityType: 'Repair',
              entityId: updated.id,
              createdById: actor.id,
            },
            tx,
          );
        }

        return tx.repair.findUnique({
          where: { id },
          include: this.defaultInclude(),
        });
      },
      { timeout: 20_000 },
    );
  }

  async remove(id: string, actor: RequestUser, dto?: DeleteWorkTaskDto) {
    void dto;
    const repair = await this.findOne(id, actor);
    if (!isAdmin(actor))
      throw new ForbiddenException(
        'Only administrators can delete repair tickets',
      );

    assertPermission(actor, PERMISSIONS.REPAIR_DELETE);
    return this.deleteRepair(id, repair, actor);
  }

  private async requestDelete(
    id: string,
    repair: Awaited<ReturnType<RepairsService['findOne']>>,
    actor: RequestUser,
    reason?: string | null,
  ) {
    assertTicketCanBeDeleted(repair.status);
    if (
      repair.reviewStatus === WorkReviewStatus.PENDING &&
      isDeleteRequest(repair.reviewNote)
    ) {
      throw new BadRequestException('Delete request is already pending review');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.repair.update({
        where: { id },
        data: {
          reviewStatus: WorkReviewStatus.PENDING,
          reviewNote: buildDeleteRequestNote(reason),
          reviewedAt: null,
          reviewerId: null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'Repair',
          entityId: id,
          actor,
          metadata: {
            action: 'REQUEST_DELETE',
            code: repair.code,
            reason: reason?.trim() || null,
          },
        },
        tx,
      );

      return next;
    });

    await this.notificationsService
      .createForAdmins({
        title: 'Yêu cầu xóa phiếu sửa chữa chờ phê duyệt',
        message: `Lý do yêu cầu xóa phiếu ${repair.code}: ${deleteRequestDisplayNote(updated.reviewNote)}`,
        href: '/service-tickets',
        entityType: 'Repair',
        entityId: repair.id,
        createdById: actor.id,
      })
      .catch(() => null);

    return { deleteRequested: true, item: updated };
  }

  private async deleteRepair(
    id: string,
    repair: Awaited<ReturnType<RepairsService['findOne']>>,
    actor: RequestUser,
  ) {
    assertTicketCanBeDeleted(repair.status);
    await this.prisma.$transaction(async (tx) => {
      await tx.repair.delete({
        where: { id },
      });

      if (repair.machine) {
        await reconcileMachineStatusFromOpenWork(
          tx,
          repair.machine.id,
          repair.machine.inventoryStatus,
        );
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'Repair',
          entityId: id,
          actor,
          metadata: {
            code: repair.code,
            machineId: repair.machineId,
            engineerId: repair.engineerId,
            status: repair.status,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  async assign(id: string, dto: AssignRepairDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.REPAIR_ASSIGN);
    if (!dto.engineerId) {
      throw new BadRequestException('engineerId is required');
    }

    const repair = await this.findOne(id, actor);
    await this.ensureEngineerExists(dto.engineerId);

    if (this.isTerminalStatus(repair.status)) {
      throw new BadRequestException('Cannot assign a closed repair');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: {
            engineerId: dto.engineerId,
            status:
              repair.status === RepairStatus.PENDING
                ? RepairStatus.ASSIGNED
                : repair.status,
            assignedAt: repair.assignedAt ?? new Date(),
          },
          include: this.defaultInclude(),
        });

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.ASSIGN,
            entityType: 'Repair',
            entityId: id,
            actor,
            changes: {
              engineerId: {
                from: repair.engineerId,
                to: updated.engineerId,
              },
              status: {
                from: repair.status,
                to: updated.status,
              },
            },
          },
          tx,
        );

        if (updated.engineerId && updated.engineerId !== repair.engineerId) {
          await this.notificationsService.create(
            {
              userId: updated.engineerId,
              title: 'Phiếu sửa chữa mới được phân công',
              message: `Phiếu ${updated.code} đã được phân công: ${updated.title}`,
              href: '/my-tasks',
              entityType: 'Repair',
              entityId: updated.id,
              createdById: actor.id,
            },
            tx,
          );
        }

        return updated;
      },
      { timeout: 20_000 },
    );
  }

  async updateStatus(
    id: string,
    dto: UpdateRepairStatusDto,
    actor: RequestUser,
  ) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    assertPermission(actor, PERMISSIONS.REPAIR_STATUS_UPDATE);
    const repair = await this.findOne(id, actor);
    assertNoPendingDeleteRequest(repair);
    const now = new Date();

    this.ensureStatusTransitionIsAllowed(repair.status, dto.status);

    if (this.statusRequiresEngineer(dto.status) && !repair.engineerId) {
      throw new BadRequestException(
        'Repair must be assigned to an engineer first',
      );
    }

    const updatedRepair = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: {
            status: dto.status,
            startedAt:
              dto.status === RepairStatus.IN_PROGRESS && !repair.startedAt
                ? now
                : undefined,
            completedAt:
              dto.status === RepairStatus.COMPLETED ? now : undefined,
            reviewStatus: this.resolveReviewStatus(dto.status, actor),
            reviewedAt:
              dto.status === RepairStatus.COMPLETED && isAdmin(actor)
                ? now
                : null,
            reviewerId:
              dto.status === RepairStatus.COMPLETED && isAdmin(actor)
                ? actor.id
                : null,
            resultNote: dto.resultNote?.trim(),
            customerFeedback: dto.customerFeedback?.trim(),
          },
          include: this.defaultInclude(),
        });

        if (
          dto.status === RepairStatus.COMPLETED &&
          updated.reviewStatus === WorkReviewStatus.APPROVED &&
          updated.customerId
        ) {
          await this.ensureCompletedRepairMachine(
            tx,
            updated.id,
            actor,
            updated.machineId,
            updated.customerId,
            updated.serialNumber,
            updated.modelName,
            updated.deviceName,
          );
        }

        let machineStatus = this.getMachineStatusForRepairStatus(
          dto.status,
          repair.machine?.inventoryStatus,
        );

        if (machineStatus && repair.machine) {
          if (
            dto.status === RepairStatus.COMPLETED ||
            dto.status === RepairStatus.CANCELLED
          ) {
            machineStatus = await reconcileMachineStatusFromOpenWork(
              tx,
              repair.machine.id,
              repair.machine.inventoryStatus,
            );
          } else {
            validateMachineState(
              machineStatus,
              repair.machine.inventoryStatus,
              repair.machine.customerId,
            );
            await tx.machine.update({
              where: { id: repair.machine.id },
              data: { status: machineStatus },
            });
          }
        }

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.STATUS_CHANGE,
            entityType: 'Repair',
            entityId: id,
            actor,
            changes: {
              status: {
                from: repair.status,
                to: updated.status,
              },
              resultNote: {
                from: repair.resultNote,
                to: updated.resultNote,
              },
              customerFeedback: {
                from: repair.customerFeedback,
                to: updated.customerFeedback,
              },
            },
            metadata: {
              machineStatus,
            },
          },
          tx,
        );

        return tx.repair.findUnique({
          where: { id },
          include: this.defaultInclude(),
        });
      },
      { timeout: 20_000 },
    );

    if (dto.status === RepairStatus.COMPLETED && isEngineer(actor)) {
      await this.notificationsService
        .createForAdmins({
          title: 'Phiếu sửa chữa chờ phê duyệt',
          message: `Phiếu ${updatedRepair.code} đã hoàn tất.`,
          href: '/service-tickets',
          entityType: 'Repair',
          entityId: updatedRepair.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updatedRepair;
  }

  async review(id: string, dto: ReviewWorkTaskDto, actor: RequestUser) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Only admins can review repair tasks');
    }

    if (
      dto.status !== WorkReviewStatus.APPROVED &&
      dto.status !== WorkReviewStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or NEEDS_REVISION',
      );
    }

    const repair = await this.findOne(id, actor);
    if (repair.reviewStatus !== WorkReviewStatus.PENDING) {
      throw new BadRequestException(
        'Only pending review repairs can be reviewed',
      );
    }

    const reviewNote = this.cleanOptionalString(dto.reviewNote);
    if (isDeleteRequest(repair.reviewNote)) {
      if (isApprovedDeleteReview(dto.status)) {
        return this.deleteRepair(id, repair, actor);
      }

      const rejected = await this.prisma.repair.update({
        where: { id },
        data: {
          reviewStatus: WorkReviewStatus.NEEDS_REVISION,
          reviewNote,
          reviewedAt: new Date(),
          reviewerId: actor.id,
        },
        include: this.defaultInclude(),
      });

      if (rejected.engineerId) {
        await this.notificationsService
          .create({
            userId: rejected.engineerId,
            title: 'Yêu cầu xóa phiếu sửa chữa chưa được duyệt',
            message: `Quản trị viên từ chối yêu cầu xóa phiếu ${rejected.code}: ${reviewNote}`,
            href: '/my-tasks',
            entityType: 'Repair',
            entityId: rejected.id,
            createdById: actor.id,
          })
          .catch(() => null);
      }

      return rejected;
    }

    if (dto.status === WorkReviewStatus.NEEDS_REVISION && !reviewNote) {
      throw new BadRequestException(
        'reviewNote is required when returning a repair',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextStatus =
        dto.status === WorkReviewStatus.NEEDS_REVISION
          ? RepairStatus.IN_PROGRESS
          : repair.status;
      const nextMachineStatus =
        dto.status === WorkReviewStatus.NEEDS_REVISION
          ? MachineStatus.REPAIRING
          : null;

      const reviewed = await tx.repair.update({
        where: { id },
        data: {
          status: nextStatus,
          completedAt:
            dto.status === WorkReviewStatus.NEEDS_REVISION
              ? null
              : repair.completedAt,
          reviewStatus: dto.status,
          reviewNote,
          reviewedAt: new Date(),
          reviewerId: actor.id,
        },
        include: this.defaultInclude(),
      });

      if (nextMachineStatus && repair.machine) {
        validateMachineState(
          nextMachineStatus,
          repair.machine.inventoryStatus,
          repair.machine.customerId,
        );
        await tx.machine.update({
          where: { id: repair.machine.id },
          data: { status: nextMachineStatus },
        });
      }

      if (
        dto.status === WorkReviewStatus.APPROVED &&
        repair.status === RepairStatus.COMPLETED
      ) {
        if (repair.customerId) {
          await this.ensureCompletedRepairMachine(
            tx,
            repair.id,
            actor,
            repair.machine?.id ?? null,
            repair.customerId,
            repair.serialNumber,
            repair.modelName,
            repair.deviceName,
          );
        }

        if (repair.machine) {
          await reconcileMachineStatusFromOpenWork(
            tx,
            repair.machine.id,
            repair.machine.inventoryStatus,
          );
        }
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'Repair',
          entityId: id,
          actor,
          changes: {
            reviewStatus: {
              from: repair.reviewStatus,
              to: reviewed.reviewStatus,
            },
            reviewNote: {
              from: repair.reviewNote,
              to: reviewed.reviewNote,
            },
            status: {
              from: repair.status,
              to: reviewed.status,
            },
          },
        },
        tx,
      );

      return tx.repair.findUnique({
        where: { id },
        include: this.defaultInclude(),
      });
    });

    if (updated.engineerId) {
      await this.notificationsService
        .create({
          userId: updated.engineerId,
          title:
            dto.status === WorkReviewStatus.APPROVED
              ? 'Phiếu sửa chữa đã được phê duyệt'
              : 'Phiếu sửa chữa cần bổ sung',
          message:
            dto.status === WorkReviewStatus.APPROVED
              ? `Quản trị viên đã phê duyệt phiếu ${updated.code}.`
              : `Quản trị viên yêu cầu bổ sung hồ sơ phiếu ${updated.code}: ${reviewNote}`,
          href: '/my-tasks',
          entityType: 'Repair',
          entityId: updated.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updated;
  }

  getStatuses() {
    return Object.values(RepairStatus);
  }

  getPriorities() {
    return Object.values(RepairPriority);
  }

  previewCode(date?: string) {
    return this.generateRepairCode(
      this.prisma,
      this.parseOptionalDate(date) ?? new Date(),
    );
  }

  private validateCreateRepair(dto: CreateRepairDto) {
    void dto;
  }

  private cleanOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private cleanOptionalUpdateString(value?: string | null) {
    return value === undefined ? undefined : this.cleanOptionalString(value);
  }

  private async ensureMachineExists(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        businessLine: {
          include: {
            productIndustry: true,
          },
        },
        machineModel: {
          include: {
            businessLine: {
              include: {
                productIndustry: true,
              },
            },
          },
        },
      },
    });

    if (!machine) {
      throw new BadRequestException('Machine does not exist');
    }

    return machine;
  }

  private async resolveTicketCustomerId(
    machine: ({ customerId?: string | null } & MachineExpertiseSource) | null,
    customerId?: string | null,
  ) {
    const cleanedCustomerId = customerId?.trim() || null;

    if (machine?.customerId) {
      if (cleanedCustomerId && cleanedCustomerId !== machine.customerId) {
        throw new BadRequestException(
          'Customer does not match selected machine',
        );
      }

      return machine.customerId;
    }

    if (!cleanedCustomerId) {
      return null;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: cleanedCustomerId },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    return customer.id;
  }

  private async ensureCompletedRepairMachine(
    tx: Prisma.TransactionClient,
    repairId: string,
    actor: RequestUser,
    existingMachineId: string | null,
    customerId: string,
    serialNumber?: string | null,
    modelName?: string | null,
    deviceName?: string | null,
  ) {
    let machineId = existingMachineId;
    const normalizedSerial = serialNumber?.trim().toUpperCase();

    if (!machineId && normalizedSerial) {
      let machine = await tx.machine.findUnique({
        where: { serialNumber: normalizedSerial },
        select: { id: true },
      });

      if (!machine) {
        machine = await tx.machine.create({
          data: {
            serialNumber: normalizedSerial,
            name: deviceName?.trim() || null,
            modelName:
              modelName?.trim() || deviceName?.trim() || 'Chưa xác định',
            manufacturer: '',
            productCategory: MachineProductCategory.OTHER,
            status: MachineStatus.ACTIVE,
            inventoryStatus: MachineInventoryStatus.INSTALLED,
            customerId,
            dataStatus: OperationalDataStatus.PENDING_REVIEW,
            createdSource: OperationalCreatedSource.SYSTEM,
          },
          select: { id: true },
        });
        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.CREATE,
            entityType: 'Machine',
            entityId: machine.id,
            actor,
            metadata: {
              source: 'COMPLETED_REPAIR',
              repairId,
              serialNumber: normalizedSerial,
              customerId,
              dataStatus: OperationalDataStatus.PENDING_REVIEW,
            },
          },
          tx,
        );
      }

      machineId = machine.id;
      await tx.repair.update({ where: { id: repairId }, data: { machineId } });
    }

    if (!machineId) return null;

    const linked = await tx.machine.updateMany({
      where: { id: machineId, customerId: null },
      data: { customerId },
    });

    if (linked.count === 0) {
      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        select: { customerId: true },
      });

      if (!machine || machine.customerId !== customerId) {
        throw new BadRequestException(
          'Machine is already linked to another customer',
        );
      }
    }

    return machineId;
  }

  private async assertEngineerCanUseMachine(
    actor: RequestUser,
    machine: MachineExpertiseSource,
  ) {
    if (!isEngineer(actor)) {
      return;
    }

    const engineer = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: { engineerProfile: true },
    });
    const expertiseGroup = engineer?.engineerProfile?.expertiseGroup;

    if (!expertiseGroup) {
      return;
    }

    const machineGroup =
      machine.businessLine?.productIndustry?.expertiseGroup ??
      machine.businessLine?.expertiseGroup ??
      machine.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine.machineModel?.businessLine?.expertiseGroup;

    if (machineGroup && machineGroup !== expertiseGroup) {
      throw new ForbiddenException(
        'Engineer can only create tickets for assigned product group',
      );
    }
  }

  private async ensureEngineerExists(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: {
        role: true,
      },
    });

    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist or is inactive');
    }

    if (engineer.role.name !== 'engineer' && engineer.role.name !== 'admin') {
      throw new BadRequestException('Assigned user must be an engineer');
    }
  }

  private async generateRepairCode(
    tx: Prisma.TransactionClient,
    date: Date,
  ): Promise<string> {
    const prefix = `SC-${shortDateCode(date)}`;

    return sequenceCode(tx, 'repair', prefix, 3, tx === this.prisma);
  }

  private async getEngineerCode(
    tx: Prisma.TransactionClient,
    engineerId?: string | null,
  ) {
    if (!engineerId) {
      return null;
    }

    const engineer = await tx.user.findUnique({
      where: { id: engineerId },
      select: {
        engineerProfile: {
          select: {
            employeeCode: true,
          },
        },
        fullName: true,
        email: true,
      },
    });

    return this.normalizeCodeSegment(
      engineer?.engineerProfile?.employeeCode ||
        engineer?.fullName ||
        engineer?.email ||
        '',
    );
  }

  private normalizeCodeSegment(value: string) {
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || null;
  }

  private getExpertiseGroupCode(machine: MachineExpertiseSource) {
    const group =
      machine?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.businessLine?.expertiseGroup ??
      machine?.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.machineModel?.businessLine?.expertiseGroup;

    if (group === 'LAB_TESTING') return 'XN';
    if (group === 'IMAGING') return 'SA';
    return 'KT';
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid reportedAt');
    }

    return date;
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return date;
  }

  private buildFindAllWhere(
    query: ListRepairsQueryDto,
  ): Prisma.RepairWhereInput {
    const search = query.search?.trim();
    const machineWhere: Prisma.MachineWhereInput = {
      businessLine: query.productIndustryId
        ? {
            productIndustryId: query.productIndustryId,
          }
        : undefined,
    };
    const and: Prisma.RepairWhereInput[] = [];

    if (query.customerId) {
      and.push({
        OR: [
          { customerId: query.customerId },
          { machine: { customerId: query.customerId } },
        ],
      });
    }

    if (query.productIndustryId) {
      and.push({ machine: machineWhere });
    }

    return {
      status: query.status,
      priority: query.priority,
      machineId: query.machineId,
      reportedAt:
        query.reportedFrom || query.reportedTo
          ? {
              gte: query.reportedFrom
                ? this.parseRequiredDate(query.reportedFrom, 'reportedFrom')
                : undefined,
              lte: query.reportedTo
                ? endOfDate(this.parseRequiredDate(query.reportedTo, 'reportedTo'))
                : undefined,
            }
          : undefined,
      engineerId: undefined,
      AND: query.engineerId
        ? [
            ...and,
            {
              OR: [
                { engineerId: query.engineerId },
                { assignments: { some: { engineerId: query.engineerId } } },
              ],
            },
          ]
        : and.length
          ? and
          : undefined,
      OR: search
        ? [
            { code: { contains: search } },
            { title: { contains: search } },
            { description: { contains: search } },
            { deviceName: { contains: search } },
            { modelName: { contains: search } },
            { serialNumber: { contains: search } },
            { usingDepartment: { contains: search } },
            { representative: { contains: search } },
            {
              machine: {
                serialNumber: { contains: search },
              },
            },
            {
              machine: {
                machineCode: { contains: search },
              },
            },
            {
              machine: {
                customer: {
                  name: { contains: search },
                },
              },
            },
          ]
        : undefined,
    };
  }

  private withAccessScope(
    where: Prisma.RepairWhereInput,
    user?: RequestUser,
  ): Prisma.RepairWhereInput {
    return {
      AND: [where, repairAccessWhere(user)],
    };
  }

  private toPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedResult<T> {
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private getMachineStatusForRepairStatus(
    status: RepairStatus,
    inventoryStatus?: MachineInventoryStatus | null,
  ): MachineStatus | null {
    if (
      status === RepairStatus.IN_PROGRESS ||
      status === RepairStatus.WAITING_PARTS
    ) {
      return MachineStatus.REPAIRING;
    }

    if (
      (status === RepairStatus.COMPLETED ||
        status === RepairStatus.CANCELLED) &&
      inventoryStatus
    ) {
      return getMachineStatusAfterWork(inventoryStatus);
    }

    return null;
  }

  private statusRequiresEngineer(status: RepairStatus): boolean {
    return (
      status === RepairStatus.ASSIGNED ||
      status === RepairStatus.IN_PROGRESS ||
      status === RepairStatus.WAITING_PARTS
    );
  }

  private resolveReviewStatus(
    status: RepairStatus,
    actor: RequestUser,
  ): WorkReviewStatus {
    if (status !== RepairStatus.COMPLETED) {
      return WorkReviewStatus.NOT_REQUIRED;
    }

    return isAdmin(actor)
      ? WorkReviewStatus.APPROVED
      : WorkReviewStatus.PENDING;
  }

  private ensureStatusTransitionIsAllowed(
    currentStatus: RepairStatus,
    nextStatus: RepairStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<RepairStatus, RepairStatus[]> = {
      [RepairStatus.PENDING]: [
        RepairStatus.ASSIGNED,
        RepairStatus.IN_PROGRESS,
        RepairStatus.COMPLETED,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.ASSIGNED]: [
        RepairStatus.IN_PROGRESS,
        RepairStatus.WAITING_PARTS,
        RepairStatus.COMPLETED,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.IN_PROGRESS]: [
        RepairStatus.WAITING_PARTS,
        RepairStatus.COMPLETED,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.WAITING_PARTS]: [
        RepairStatus.IN_PROGRESS,
        RepairStatus.COMPLETED,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.COMPLETED]: [],
      [RepairStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid repair status transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private isTerminalStatus(status: RepairStatus): boolean {
    return (
      status === RepairStatus.COMPLETED || status === RepairStatus.CANCELLED
    );
  }

  private pickChangedFields<T extends Record<string, unknown>>(
    before: T,
    after: T,
    fields: string[],
  ) {
    return fields.reduce<Record<string, { from: unknown; to: unknown }>>(
      (changes, field) => {
        if (before[field] !== after[field]) {
          changes[field] = {
            from: before[field],
            to: after[field],
          };
        }

        return changes;
      },
      {},
    );
  }

  private defaultInclude() {
    return {
      machine: {
        include: {
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
          machineModel: {
            include: {
              businessLine: {
                include: {
                  productIndustry: true,
                },
              },
            },
          },
          customer: {
            include: {
              region: true,
            },
          },
        },
      },
      usedParts: true,
      customer: {
        include: {
          region: true,
        },
      },
      engineer: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      assignments: {
        include: {
          engineer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              engineerProfile: true,
            },
          },
        },
        orderBy: [{ isLead: 'desc' as const }, { assignedAt: 'asc' as const }],
      },
    };
  }
}

function endOfDate(value: Date) {
  const end = new Date(value);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}
