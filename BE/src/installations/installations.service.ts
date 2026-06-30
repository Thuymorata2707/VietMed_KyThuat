import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstallationStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
  WarrantyStatus,
  WorkReviewStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { installationAccessWhere, isAdmin, isEngineer } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateInventoryMovement } from '../machines/machine-state.rules';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { ListInstallationsQueryDto } from './dto/list-installations-query.dto';
import { UpdateInstallationDto } from './dto/update-installation.dto';
import { UpdateInstallationStatusDto } from './dto/update-installation-status.dto';

@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateInstallationDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_CREATE);
    this.validateCreate(dto);

    const installedById = isEngineer(actor) ? actor.id : dto.installedById;

    const [machine, customer, engineer, businessLine, machineModel] = await Promise.all([
      dto.machineId ? this.findMachine(dto.machineId) : Promise.resolve(null),
      this.findCustomer(dto.customerId),
      this.findEngineer(installedById),
      this.findBusinessLine(dto.businessLineId),
      dto.machineModelId ? this.findMachineModel(dto.machineModelId) : Promise.resolve(null),
    ]);

    if (machine?.inventoryStatus === MachineInventoryStatus.INSTALLED) {
      throw new BadRequestException('Machine is already installed');
    }

    if (machine) {
      await this.assertEngineerCanUseMachine(actor, machine);
    }

    const installedAt =
      this.parseOptionalDate(dto.installedAt, 'installedAt') ?? new Date();
    const warrantyStartDate =
      this.parseOptionalDate(dto.warrantyStartDate, 'warrantyStartDate') ??
      installedAt;
    const warrantyEndDate = this.parseOptionalDate(
      dto.warrantyEndDate,
      'warrantyEndDate',
    );

    if (warrantyEndDate && warrantyEndDate < warrantyStartDate) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const installationCode = await this.generateInstallationCode(
        tx,
        machine,
        machineModel,
        businessLine,
        engineer,
      );
        const installation = await tx.machineInstallation.create({
          data: {
            code: installationCode,
            status: InstallationStatus.PENDING,
            machineId: machine?.id ?? null,
            plannedMachineModelId: machineModel?.id ?? null,
            plannedModelName:
              machineModel?.name ?? dto.plannedModelName?.trim() ?? null,
            customerId: customer.id,
            businessLineId:
              businessLine?.id ??
              machine?.businessLineId ??
              machineModel?.businessLineId ??
              null,
            installedById: engineer.id,
            installedAt,
            accessories: this.normalizeAccessories(dto.accessories),
            note: dto.note?.trim() || null,
            warrantyStartDate,
            warrantyEndDate,
            warrantyNote: dto.warrantyNote?.trim() || null,
            handoverInstallerName: this.cleanOptionalString(
              dto.handoverInstallerName,
            ),
            handoverInstallerPosition: this.cleanOptionalString(
              dto.handoverInstallerPosition,
            ),
            handoverVehicle: this.cleanOptionalString(dto.handoverVehicle),
            handoverDepartureDate: this.parseOptionalDate(
              dto.handoverDepartureDate,
              'handoverDepartureDate',
            ),
            receiverInstallAddress: this.cleanOptionalString(
              dto.receiverInstallAddress,
            ),
            receiverRepresentative: this.cleanOptionalString(
              dto.receiverRepresentative,
            ),
            receiverPosition: this.cleanOptionalString(dto.receiverPosition),
            receiverPhone: this.cleanOptionalString(dto.receiverPhone),
            installedDeviceItems: this.normalizeDeviceItems(
              dto.installedDeviceItems,
            ),
            deviceCondition: dto.deviceCondition || 'NEW_100',
            deviceConditionNote: this.cleanOptionalString(
              dto.deviceConditionNote,
            ),
          },
        });

        if (machine && warrantyEndDate) {
          await tx.warrantyCard.create({
            data: {
              code: await this.generateWarrantyCode(tx),
              installationId: installation.id,
              machineId: machine.id,
              customerId: customer.id,
              issuedAt: new Date(),
              startDate: warrantyStartDate,
              endDate: warrantyEndDate,
              note: dto.warrantyNote?.trim() || null,
              issuedById: actor?.id || null,
              issuedByEmail: actor?.email || null,
            },
          });
        }

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.CREATE_INSTALLATION,
            entityType: 'MachineInstallation',
            entityId: installation.id,
            actor,
            metadata: {
              code: installationCode,
              machineId: machine?.id ?? null,
              serialNumber: machine?.serialNumber ?? null,
              plannedMachineModelId: machineModel?.id ?? null,
              plannedModelName:
                machineModel?.name ?? dto.plannedModelName?.trim() ?? null,
              customerId: customer.id,
              installedById: engineer.id,
              status: InstallationStatus.PENDING,
            },
          },
          tx,
        );

        if (isEngineer(actor)) {
          await this.notificationsService.createForAdmins(
            {
              title: 'Kỹ sư tạo phiếu lắp đặt mới',
              message: `${actor.email} đã tạo phiếu ${installationCode}. Vui lòng kiểm tra và duyệt dữ liệu liên quan.`,
              href: '/installations',
              entityType: 'MachineInstallation',
              entityId: installation.id,
              createdById: actor.id,
            },
            tx,
          );
        }

        return tx.machineInstallation.findUnique({
          where: { id: installation.id },
          include: this.defaultInclude(),
        });
    });
  }

  async findAll(
    query: ListInstallationsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineInstallation.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [
          { installedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineInstallation.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const installation = await this.prisma.machineInstallation.findFirst({
      where: this.withAccessScope({ id }, user),
      include: this.defaultInclude(),
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }

  async update(id: string, dto: UpdateInstallationDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_UPDATE);
    const installation = await this.findOne(id, actor);
    const installedBy = dto.installedById
      ? await this.findEngineer(dto.installedById)
      : null;
    const businessLine =
      dto.businessLineId === undefined
        ? undefined
        : await this.findBusinessLine(dto.businessLineId);
    const installedAt = this.parseOptionalDate(dto.installedAt, 'installedAt');
    const warrantyStartDate = this.parseOptionalDate(
      dto.warrantyStartDate,
      'warrantyStartDate',
    );
    const warrantyEndDate = this.parseOptionalDate(
      dto.warrantyEndDate,
      'warrantyEndDate',
    );
    const handoverDepartureDate = this.parseOptionalDate(
      dto.handoverDepartureDate,
      'handoverDepartureDate',
    );
    const nextWarrantyStartDate =
      warrantyStartDate ??
      installation.warrantyStartDate ??
      installation.warrantyCard?.startDate ??
      null;
    const nextWarrantyEndDate =
      warrantyEndDate ??
      installation.warrantyEndDate ??
      installation.warrantyCard?.endDate ??
      null;

    if (
      nextWarrantyStartDate &&
      nextWarrantyEndDate &&
      nextWarrantyEndDate < nextWarrantyStartDate
    ) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    const isAssignedEngineerCompleting =
      isEngineer(actor) &&
      installation.installedById === actor.id &&
      installation.status === InstallationStatus.PENDING &&
      dto.status === InstallationStatus.INSTALLED;
    const isAdminApprovingInstallation =
      isAdmin(actor) &&
      installation.status === InstallationStatus.PENDING &&
      dto.status === InstallationStatus.INSTALLED;

    if (
      !isAdmin(actor) &&
      dto.status &&
      dto.status !== installation.status &&
      !isAssignedEngineerCompleting
    ) {
      throw new ForbiddenException('Only admin can change installation status');
    }

    const updatedInstallation = await this.prisma.$transaction(async (tx) => {
      let completedMachineId: string | undefined;
      if (isAdminApprovingInstallation) {
        const actualMachine = await this.resolveActualInstallationMachine(
          tx,
          installation,
          dto,
          actor,
        );
        completedMachineId = actualMachine.id;
        const nextInstalledAt = installedAt ?? installation.installedAt;
        const approvedWarrantyStartDate =
          warrantyStartDate ??
          installation.warrantyStartDate ??
          installation.warrantyCard?.startDate ??
          nextInstalledAt;
        const approvedWarrantyEndDate =
          warrantyEndDate ??
          installation.warrantyEndDate ??
          installation.warrantyCard?.endDate ??
          nextInstalledAt;

        validateInventoryMovement(
          InventoryMovementType.INSTALL,
          actualMachine.inventoryStatus,
          MachineInventoryStatus.INSTALLED,
          installation.customerId,
        );

        const machineUpdate = await tx.machine.updateMany({
          where: {
            id: actualMachine.id,
            inventoryStatus: actualMachine.inventoryStatus,
          },
          data: {
            customerId: installation.customerId,
            businessLineId:
              dto.businessLineId === undefined
                ? installation.businessLineId ?? actualMachine.businessLineId
                : businessLine?.id ?? null,
            installedById: installedBy?.id ?? installation.installedById,
            primaryEngineerId:
              installedBy?.id ?? installation.installedById ?? undefined,
            installDate: nextInstalledAt,
            warrantyStartDate: approvedWarrantyStartDate,
            warrantyEndDate: approvedWarrantyEndDate,
            inventoryStatus: MachineInventoryStatus.INSTALLED,
            status: MachineStatus.ACTIVE,
          },
        });

        if (machineUpdate.count !== 1) {
          throw new BadRequestException(
            'Machine has already been installed or changed status',
          );
        }

        await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
            type: InventoryMovementType.INSTALL,
            machineId: actualMachine.id,
            fromStatus: actualMachine.inventoryStatus,
            toStatus: MachineInventoryStatus.INSTALLED,
            occurredAt: nextInstalledAt,
            note: `Approved installation ${installation.code}`,
            customerId: installation.customerId,
            createdById: actor?.id || null,
          },
        });
      } else if (isAssignedEngineerCompleting) {
        const actualMachine = await this.resolveActualInstallationMachine(
          tx,
          installation,
          dto,
          actor,
        );
        completedMachineId = actualMachine.id;
      }

      if (
        installation.status === InstallationStatus.PENDING &&
        dto.status === InstallationStatus.CANCELLED
      ) {
        await tx.warrantyCard.updateMany({
          where: { installationId: id },
          data: { status: WarrantyStatus.CANCELLED },
        });
      }

      const updated = await tx.machineInstallation.update({
        where: { id },
        data: {
          status: isAssignedEngineerCompleting ? installation.status : dto.status,
          machineId: completedMachineId ?? dto.machineId ?? undefined,
          installedAt: installedAt ?? undefined,
          installedById: installedBy?.id,
          reviewStatus: isAssignedEngineerCompleting
            ? WorkReviewStatus.PENDING
            : isAdminApprovingInstallation
              ? WorkReviewStatus.APPROVED
              : dto.status
                ? WorkReviewStatus.NOT_REQUIRED
                : undefined,
          reviewNote:
            isAssignedEngineerCompleting || isAdminApprovingInstallation
              ? null
              : undefined,
          reviewedAt: isAdminApprovingInstallation
            ? new Date()
            : isAssignedEngineerCompleting
              ? null
              : undefined,
          reviewerId: isAdminApprovingInstallation
            ? actor.id
            : isAssignedEngineerCompleting
              ? null
              : undefined,
          plannedMachineModelId: dto.machineModelId ?? undefined,
          businessLineId:
            dto.businessLineId === undefined ? undefined : businessLine?.id ?? null,
          accessories:
            dto.accessories === undefined
              ? undefined
              : this.normalizeAccessories(dto.accessories),
          note:
            dto.note === undefined ? undefined : dto.note?.trim() || null,
          warrantyStartDate:
            dto.warrantyStartDate === undefined
              ? undefined
              : warrantyStartDate ?? null,
          warrantyEndDate:
            dto.warrantyEndDate === undefined
              ? undefined
              : warrantyEndDate ?? null,
          warrantyNote:
            dto.warrantyNote === undefined
              ? undefined
              : dto.warrantyNote?.trim() || null,
          handoverInstallerName:
            dto.handoverInstallerName === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverInstallerName),
          handoverInstallerPosition:
            dto.handoverInstallerPosition === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverInstallerPosition),
          handoverVehicle:
            dto.handoverVehicle === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverVehicle),
          handoverDepartureDate:
            dto.handoverDepartureDate === undefined
              ? undefined
              : handoverDepartureDate ?? null,
          receiverInstallAddress:
            dto.receiverInstallAddress === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverInstallAddress),
          receiverRepresentative:
            dto.receiverRepresentative === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverRepresentative),
          receiverPosition:
            dto.receiverPosition === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverPosition),
          receiverPhone:
            dto.receiverPhone === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverPhone),
          installedDeviceItems:
            dto.installedDeviceItems === undefined
              ? undefined
              : this.normalizeDeviceItems(dto.installedDeviceItems),
          deviceCondition:
            dto.deviceCondition === undefined ? undefined : dto.deviceCondition,
          deviceConditionNote:
            dto.deviceConditionNote === undefined
              ? undefined
              : this.cleanOptionalString(dto.deviceConditionNote),
        },
        include: this.defaultInclude(),
      });

      if (warrantyStartDate || warrantyEndDate || dto.warrantyNote !== undefined) {
        const warrantyUpdate = await tx.warrantyCard.updateMany({
          where: { installationId: id },
          data: {
            startDate: warrantyStartDate ?? undefined,
            endDate: warrantyEndDate ?? undefined,
            note:
              dto.warrantyNote === undefined
                ? undefined
                : dto.warrantyNote?.trim() || null,
          },
        });

        if (warrantyUpdate.count === 0 && updated.machineId && warrantyEndDate) {
          await tx.warrantyCard.create({
            data: {
              code: await this.generateWarrantyCode(tx),
              installationId: id,
              machineId: updated.machineId,
              customerId: updated.customerId,
              issuedAt: new Date(),
              startDate: warrantyStartDate ?? updated.installedAt,
              endDate: warrantyEndDate,
              note: dto.warrantyNote?.trim() || null,
              issuedById: actor?.id || null,
              issuedByEmail: actor?.email || null,
            },
          });
        }
      }

      if (
        installedAt ||
        installedBy ||
        warrantyStartDate ||
        warrantyEndDate ||
        dto.businessLineId !== undefined
      ) {
        const machineId = updated.machineId;
        if (machineId) {
          await tx.machine.update({
            where: { id: machineId },
            data: {
              installedById: installedBy?.id,
              primaryEngineerId: installedBy?.id,
              installDate: installedAt ?? undefined,
              warrantyStartDate: warrantyStartDate ?? undefined,
              warrantyEndDate: warrantyEndDate ?? undefined,
              businessLineId:
                dto.businessLineId === undefined
                  ? undefined
                  : businessLine?.id ?? installation.machine?.businessLineId,
            },
          });
        }
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.UPDATE,
          entityType: 'MachineInstallation',
          entityId: id,
          actor,
          changes: {
            status: { from: installation.status, to: updated.status },
            installedAt: {
              from: installation.installedAt,
              to: updated.installedAt,
            },
            installedById: {
              from: installation.installedById,
              to: updated.installedById,
            },
            businessLineId: {
              from: installation.businessLineId,
              to: updated.businessLineId,
            },
            accessories: {
              from: installation.accessories,
              to: updated.accessories,
            },
            note: { from: installation.note, to: updated.note },
          },
        },
        tx,
      );

      return updated;
    });

    if (isAssignedEngineerCompleting) {
      await this.notificationsService
        .createForAdmins({
          title: 'Phiếu lắp đặt chờ xác nhận',
          message: `${actor.email} đã báo hoàn tất phiếu ${updatedInstallation.code}. Vui lòng kiểm tra trước khi xác nhận lắp đặt.`,
          href: '/my-tasks',
          entityType: 'MachineInstallation',
          entityId: updatedInstallation.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updatedInstallation;
  }

  async remove(id: string, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_DELETE);
    const installation = await this.findOne(id, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.warrantyCard.deleteMany({
        where: { installationId: id },
      });

      await tx.machineInstallation.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'MachineInstallation',
          entityId: id,
          actor,
          metadata: {
            code: installation.code,
            machineId: installation.machineId,
            customerId: installation.customerId,
            installedById: installation.installedById,
            status: installation.status,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  async updateStatus(
    id: string,
    dto: UpdateInstallationStatusDto,
    actor: RequestUser,
  ) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    assertPermission(actor, PERMISSIONS.INSTALLATION_STATUS_UPDATE);
    const installation = await this.findOne(id, actor);
    const installedAt = this.parseOptionalDate(dto.installedAt, 'installedAt');
    const isPendingDecision =
      installation.status === InstallationStatus.PENDING &&
      (dto.status === InstallationStatus.INSTALLED ||
        dto.status === InstallationStatus.CANCELLED);

    if (isPendingDecision && !isAdmin(actor)) {
      throw new ForbiddenException('Only admin can approve installation requests');
    }

    return this.prisma.$transaction(async (tx) => {
      if (
        installation.status === InstallationStatus.PENDING &&
        dto.status === InstallationStatus.INSTALLED
      ) {
        if (!installation.machine) {
          throw new BadRequestException(
            'Machine serial number must be updated before approving installation',
          );
        }
        const nextInstalledAt = installedAt ?? installation.installedAt;
        const warrantyStartDate =
          installation.warrantyStartDate ??
          installation.warrantyCard?.startDate ??
          nextInstalledAt;
        const warrantyEndDate =
          installation.warrantyEndDate ??
          installation.warrantyCard?.endDate ??
          nextInstalledAt;

        validateInventoryMovement(
          InventoryMovementType.INSTALL,
          installation.machine.inventoryStatus,
          MachineInventoryStatus.INSTALLED,
          installation.customerId,
        );

        const machineUpdate = await tx.machine.updateMany({
          where: {
            id: installation.machineId,
            inventoryStatus: installation.machine.inventoryStatus,
          },
          data: {
            customerId: installation.customerId,
            businessLineId:
              installation.businessLineId ?? installation.machine.businessLineId,
            installedById: installation.installedById,
            primaryEngineerId: installation.installedById ?? undefined,
            installDate: nextInstalledAt,
            warrantyStartDate,
            warrantyEndDate,
            inventoryStatus: MachineInventoryStatus.INSTALLED,
            status: MachineStatus.ACTIVE,
          },
        });

        if (machineUpdate.count !== 1) {
          throw new BadRequestException(
            'Machine has already been installed or changed status',
          );
        }

        await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
            type: InventoryMovementType.INSTALL,
            machineId: installation.machineId,
            fromStatus: installation.machine.inventoryStatus,
            toStatus: MachineInventoryStatus.INSTALLED,
            occurredAt: nextInstalledAt,
            note: `Approved installation ${installation.code}`,
            customerId: installation.customerId,
            createdById: actor?.id || null,
          },
        });

        if (warrantyEndDate) {
          const warrantyUpdate = await tx.warrantyCard.updateMany({
            where: { installationId: id },
            data: {
              machineId: installation.machine.id,
              customerId: installation.customerId,
              startDate: warrantyStartDate,
              endDate: warrantyEndDate,
              note: installation.warrantyNote,
            },
          });

          if (warrantyUpdate.count === 0) {
            await tx.warrantyCard.create({
              data: {
                code: await this.generateWarrantyCode(tx),
                installationId: id,
                machineId: installation.machine.id,
                customerId: installation.customerId,
                issuedAt: new Date(),
                startDate: warrantyStartDate,
                endDate: warrantyEndDate,
                note: installation.warrantyNote,
                issuedById: actor?.id || null,
                issuedByEmail: actor?.email || null,
              },
            });
          }
        }
      }

      if (
        installation.status === InstallationStatus.PENDING &&
        dto.status === InstallationStatus.CANCELLED
      ) {
        await tx.warrantyCard.updateMany({
          where: { installationId: id },
          data: { status: WarrantyStatus.CANCELLED },
        });
      }

      const updated = await tx.machineInstallation.update({
        where: { id },
        data: {
          status: dto.status,
          installedAt: installedAt ?? undefined,
          note: dto.note?.trim(),
          reviewStatus:
            dto.status === InstallationStatus.INSTALLED
              ? WorkReviewStatus.APPROVED
              : dto.status
                ? WorkReviewStatus.NOT_REQUIRED
                : undefined,
          reviewedAt:
            dto.status === InstallationStatus.INSTALLED ? new Date() : undefined,
          reviewerId:
            dto.status === InstallationStatus.INSTALLED ? actor.id : undefined,
          reviewNote:
            dto.status === InstallationStatus.INSTALLED ? null : undefined,
        },
        include: this.defaultInclude(),
      });

      if (installedAt) {
        await tx.machine.update({
          where: { id: installation.machineId },
          data: {
            installDate: installedAt,
          },
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'MachineInstallation',
          entityId: id,
          actor,
          changes: {
            status: {
              from: installation.status,
              to: updated.status,
            },
            installedAt: {
              from: installation.installedAt,
              to: updated.installedAt,
            },
            note: {
              from: installation.note,
              to: updated.note,
            },
          },
        },
        tx,
      );

      return updated;
    });
  }

  async review(id: string, dto: ReviewWorkTaskDto, actor: RequestUser) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Only admins can review installation tasks');
    }

    if (
      dto.status !== WorkReviewStatus.APPROVED &&
      dto.status !== WorkReviewStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or NEEDS_REVISION',
      );
    }

    const installation = await this.findOne(id, actor);
    if (installation.reviewStatus !== WorkReviewStatus.PENDING) {
      throw new BadRequestException(
        'Only pending review installations can be reviewed',
      );
    }

    const reviewNote = this.cleanOptionalString(dto.reviewNote);
    if (dto.status === WorkReviewStatus.NEEDS_REVISION && !reviewNote) {
      throw new BadRequestException(
        'reviewNote is required when returning an installation',
      );
    }

    const updated =
      dto.status === WorkReviewStatus.APPROVED
        ? await this.update(
            id,
            {
              status: InstallationStatus.INSTALLED,
              warrantyEndDate: installation.warrantyEndDate
                ? installation.warrantyEndDate.toISOString()
                : installation.warrantyCard?.endDate
                ? installation.warrantyCard.endDate.toISOString()
                : undefined,
              warrantyStartDate: installation.warrantyStartDate
                ? installation.warrantyStartDate.toISOString()
                : installation.warrantyCard?.startDate
                ? installation.warrantyCard.startDate.toISOString()
                : undefined,
              warrantyNote: installation.warrantyNote ?? undefined,
              reviewNote,
            } as UpdateInstallationDto,
            actor,
          )
        : await this.prisma.$transaction(async (tx) => {
            const reviewed = await tx.machineInstallation.update({
              where: { id },
              data: {
                reviewStatus: WorkReviewStatus.NEEDS_REVISION,
                reviewNote,
                reviewedAt: new Date(),
                reviewerId: actor.id,
              },
              include: this.defaultInclude(),
            });

            await this.auditLogsService.create(
              {
                action: AUDIT_ACTIONS.STATUS_CHANGE,
                entityType: 'MachineInstallation',
                entityId: id,
                actor,
                changes: {
                  reviewStatus: {
                    from: installation.reviewStatus,
                    to: reviewed.reviewStatus,
                  },
                  reviewNote: {
                    from: installation.reviewNote,
                    to: reviewed.reviewNote,
                  },
                },
              },
              tx,
            );

            return reviewed;
          });

    if (updated.installedById) {
      await this.notificationsService
        .create({
          userId: updated.installedById,
          title:
            dto.status === WorkReviewStatus.APPROVED
              ? 'Phiếu lắp đặt đã được xác nhận'
              : 'Phiếu lắp đặt cần bổ sung',
          message:
            dto.status === WorkReviewStatus.APPROVED
              ? `Admin đã xác nhận phiếu ${updated.code}.`
              : `Admin yêu cầu bổ sung phiếu ${updated.code}: ${reviewNote}`,
          href: '/my-tasks',
          entityType: 'MachineInstallation',
          entityId: updated.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updated;
  }

  getStatuses() {
    return Object.values(InstallationStatus);
  }

  private validateCreate(dto: CreateInstallationDto) {
    if (
      !dto.customerId ||
      !dto.installedById ||
      (!dto.machineId && !dto.machineModelId && !dto.plannedModelName?.trim())
    ) {
      throw new BadRequestException(
        'customerId, installedById and machineId or planned model are required',
      );
    }

    if (dto.deviceCondition === 'OTHER' && !dto.deviceConditionNote?.trim()) {
      throw new BadRequestException(
        'deviceConditionNote is required when deviceCondition is OTHER',
      );
    }
  }

  private async findMachine(machineId: string) {
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

  private async findMachineModel(machineModelId: string) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id: machineModelId },
      include: {
        businessLine: {
          include: {
            productIndustry: true,
          },
        },
      },
    });

    if (!machineModel) {
      throw new BadRequestException('Machine model does not exist');
    }

    return machineModel;
  }

  private async assertEngineerCanUseMachine(
    actor: RequestUser,
    machine: Awaited<ReturnType<InstallationsService['findMachine']>>,
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

  private async resolveActualInstallationMachine(
    tx: Prisma.TransactionClient,
    installation: any,
    dto: UpdateInstallationDto,
    actor: RequestUser,
  ) {
    const existingMachineId = dto.machineId || installation.machineId;
    if (existingMachineId) {
      const machine = await tx.machine.findUnique({
        where: { id: existingMachineId },
      });
      if (!machine) {
        throw new BadRequestException('Machine does not exist');
      }
      return machine;
    }

    const serialNumber =
      dto.machineSerialNumber?.trim() ||
      dto.installedDeviceItems?.find((item) => item.serialNumber?.trim())
        ?.serialNumber?.trim();

    if (!serialNumber) {
      throw new BadRequestException(
        'Machine serial number is required to complete installation',
      );
    }

    const machineModelId = dto.machineModelId || installation.plannedMachineModelId;
    const machineModel = machineModelId
      ? await tx.machineModel.findUnique({
          where: { id: machineModelId },
          include: { businessLine: true },
        })
      : null;
    const fallbackModelName =
      dto.installedDeviceItems?.find((item) => item.model?.trim())?.model?.trim() ||
      installation.plannedModelName ||
      dto.machineName?.trim() ||
      'Máy lắp đặt';

    const machine = await tx.machine.create({
      data: {
        machineCode: dto.machineCode?.trim() || null,
        serialNumber: serialNumber.toUpperCase(),
        name: dto.machineName?.trim() || machineModel?.displayName || machineModel?.name || fallbackModelName,
        modelName: machineModel?.name || fallbackModelName,
        manufacturer: machineModel?.manufacturer || '',
        productCategory: machineModel?.productCategory || 'OTHER',
        productLine: machineModel?.productLine || null,
        machineModelId: machineModel?.id || null,
        businessLineId:
          installation.businessLineId || machineModel?.businessLineId || null,
        customerId: installation.customerId,
        installedById: installation.installedById,
        primaryEngineerId: installation.installedById,
        inventoryStatus: MachineInventoryStatus.IN_STOCK,
        status: MachineStatus.ACTIVE,
        createdSource: isEngineer(actor) ? 'ENGINEER' : 'ADMIN',
        dataStatus: isEngineer(actor) ? 'PENDING_REVIEW' : 'VERIFIED',
      },
    });

    const accessoryInputs: Array<{
      code?: string | null;
      name?: string | null;
      serialNumber?: string | null;
      description?: string | null;
      note?: string | null;
    }> | undefined = dto.machineAccessories?.length
      ? dto.machineAccessories
      : dto.installedDeviceItems
          ?.filter((item, index) => index > 0 && (item.itemName || item.serialNumber))
          .map((item) => ({
            name: item.itemName,
            serialNumber: item.serialNumber,
            description: item.model,
          }));

    if (accessoryInputs?.length) {
      await tx.machineAccessory.createMany({
        data: accessoryInputs
          .filter((accessory) => accessory.name?.trim())
          .map((accessory) => ({
            machineId: machine.id,
            code: accessory.code?.trim() || null,
            name: accessory.name.trim(),
            serialNumber: accessory.serialNumber?.trim()?.toUpperCase() || null,
            description: accessory.description?.trim() || null,
            note: accessory.note?.trim() || null,
          })),
        skipDuplicates: true,
      });
    }

    return machine;
  }

  private async findCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    return customer;
  }

  private async findEngineer(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: {
        role: true,
        engineerProfile: true,
      },
    });

    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist or is inactive');
    }

    if (engineer.role.name !== 'engineer' && engineer.role.name !== 'admin') {
      throw new BadRequestException('Installed by user must be an engineer');
    }

    return engineer;
  }

  private async findBusinessLine(businessLineId?: string | null) {
    if (!businessLineId) {
      return null;
    }

    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id: businessLineId },
      include: { productIndustry: true },
    });

    if (!businessLine) {
      throw new BadRequestException('Business line does not exist');
    }

    return businessLine;
  }

  private normalizeAccessories(accessories?: string[]): string[] {
    if (!accessories?.length) {
      return [];
    }

    return accessories
      .map((accessory) => accessory.trim())
      .filter((accessory) => accessory.length > 0);
  }

  private normalizeDeviceItems(
    items?: CreateInstallationDto['installedDeviceItems'],
  ): Prisma.InputJsonValue {
    if (!items?.length) {
      return [];
    }

    return items
      .map((item) => ({
        itemName: item.itemName?.trim(),
        model: item.model?.trim() || null,
        serialNumber: item.serialNumber?.trim() || null,
        manufactureDate: item.manufactureDate || null,
        quantity: Number(item.quantity) || 1,
        warrantyPeriod: item.warrantyPeriod?.trim() || null,
      }))
      .filter((item) => item.itemName);
  }

  private cleanOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    return this.parseRequiredDate(value, fieldName);
  }

  private buildFindAllWhere(
    query: ListInstallationsQueryDto,
  ): Prisma.MachineInstallationWhereInput {
    const search = query.search?.trim();
    const baseWhere: Prisma.MachineInstallationWhereInput = {
      status: query.status,
      customerId: query.customerId,
      machineId: query.machineId,
      businessLineId: query.businessLineId,
      installedById: query.installedById,
      installedAt:
        query.installedFrom || query.installedTo
          ? {
              gte: query.installedFrom
                ? this.parseRequiredDate(query.installedFrom, 'installedFrom')
                : undefined,
              lte: query.installedTo
                ? this.parseRequiredDate(query.installedTo, 'installedTo')
                : undefined,
            }
          : undefined,
      OR: search
        ? [
            { code: { contains: search,  } },
            { note: { contains: search,  } },
            {
              machine: {
                serialNumber: { contains: search,  },
              },
            },
            {
              machine: {
                modelName: { contains: search,  },
              },
            },
            {
              customer: {
                name: { contains: search,  },
              },
            },
            {
              businessLine: {
                name: { contains: search,  },
              },
            },
            {
              businessLine: {
                manufacturer: { contains: search,  },
              },
            },
          ]
        : undefined,
    };

    if (!query.productIndustryId) {
      return baseWhere;
    }

    return {
      AND: [
        baseWhere,
        {
          OR: [
            {
              businessLine: {
                productIndustryId: query.productIndustryId,
              },
            },
            {
              machine: {
                businessLine: {
                  productIndustryId: query.productIndustryId,
                },
              },
            },
            {
              plannedMachineModel: {
                businessLine: {
                  productIndustryId: query.productIndustryId,
                },
              },
            },
          ],
        },
      ],
    };
  }

  private withAccessScope(
    where: Prisma.MachineInstallationWhereInput,
    user?: RequestUser,
  ): Prisma.MachineInstallationWhereInput {
    return {
      AND: [where, installationAccessWhere(user)],
    };
  }

  private async generateInstallationCode(
    tx: Prisma.TransactionClient,
    machine: Awaited<ReturnType<InstallationsService['findMachine']>> | null,
    machineModel?: Awaited<ReturnType<InstallationsService['findMachineModel']>> | null,
    businessLine?: Awaited<ReturnType<InstallationsService['findBusinessLine']>> | null,
    engineer?: Awaited<ReturnType<InstallationsService['findEngineer']>> | null,
  ): Promise<string> {
    const engineerCode = this.normalizeCodeSegment(
      engineer?.engineerProfile?.employeeCode ||
        engineer?.fullName ||
        engineer?.email ||
        '',
    );
    const prefix = `LD-${engineerCode ?? this.getExpertiseGroupCode(machine, machineModel, businessLine)}-${new Date().getFullYear()}`;
    const latest = await tx.machineInstallation.findFirst({
      where: {
        code: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });
    const latestNumber = latest?.code
      ? Number(latest.code.slice(prefix.length + 1))
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
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

  private getExpertiseGroupCode(
    machine?: Awaited<ReturnType<InstallationsService['findMachine']>> | null,
    machineModel?: Awaited<ReturnType<InstallationsService['findMachineModel']>> | null,
    businessLine?: Awaited<ReturnType<InstallationsService['findBusinessLine']>> | null,
  ) {
    const group =
      businessLine?.productIndustry?.expertiseGroup ??
      businessLine?.expertiseGroup ??
      machine?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.businessLine?.expertiseGroup ??
      machine?.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.machineModel?.businessLine?.expertiseGroup ??
      machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machineModel?.businessLine?.expertiseGroup;

    if (group === 'LAB_TESTING') return 'XN';
    if (group === 'IMAGING') return 'SA';
    return 'KT';
  }

  private async generateWarrantyCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('WAR');
    const latest = await tx.warrantyCard.findFirst({
      where: {
        code: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });
    const latestNumber = latest?.code
      ? Number(latest.code.slice(prefix.length + 1))
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  private async generateMovementCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('INV');
    const latest = await tx.machineInventoryMovement.findFirst({
      where: {
        code: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });
    const latestNumber = latest?.code
      ? Number(latest.code.slice(prefix.length + 1))
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  private getDailyCodePrefix(prefix: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${prefix}-${year}${month}${day}`;
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

  private defaultInclude() {
    return {
      machine: {
        select: {
          id: true,
          businessLineId: true,
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
          machineCode: true,
          serialNumber: true,
          modelName: true,
          name: true,
          manufacturer: true,
          inventoryStatus: true,
          status: true,
          warrantyStartDate: true,
          warrantyEndDate: true,
        },
      },
      customer: {
        include: {
          region: true,
        },
      },
      businessLine: {
        include: {
          productIndustry: true,
        },
      },
      plannedMachineModel: {
        include: {
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
        },
      },
      installedBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          region: true,
          engineerProfile: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      warrantyCard: true,
    };
  }
}
