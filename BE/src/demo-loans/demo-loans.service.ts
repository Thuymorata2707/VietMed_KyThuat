import { sequenceCode } from '../common/sequence-code';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemoLoanMachineUse,
  DemoMachineCategory,
  DemoLoanStatus,
  DemoPreparationStatus,
  DeviceServiceTicketStatus,
  InventoryMovementType,
  MaintenanceStatus,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
  RepairStatus,
} from '@prisma/client';
import {
  demoLoanAccessWhere,
  isAdmin,
  isEngineer,
  isManager,
} from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateInventoryMovement } from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteDemoLoanDto } from './dto/complete-demo-loan.dto';
import { CreateDemoLoanBatchDto, CreateDemoLoanDto } from './dto/create-demo-loan.dto';
import { ListDemoLoansQueryDto } from './dto/list-demo-loans-query.dto';
import { UpdateDemoLoanDto } from './dto/update-demo-loan.dto';

@Injectable()
export class DemoLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(
    query: ListDemoLoansQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DemoLoanWhereInput = {
      AND: [demoLoanAccessWhere(user), await this.buildWhere(query, user)],
    };

    await this.refreshOverdueLoans();

    const [data, total] = await this.prisma.$transaction([
      this.prisma.demoLoan.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.demoLoan.count({ where }),
    ]);

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

  async findOne(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_READ);
    await this.refreshOverdueLoans();
    const item = await this.prisma.demoLoan.findFirst({
      where: { AND: [{ id }, demoLoanAccessWhere(user)] },
      include: this.defaultInclude(),
    });
    if (!item) throw new NotFoundException('Demo loan not found');
    return item;
  }

  async create(dto: CreateDemoLoanDto, user?: RequestUser, ticketCode?: string) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_CREATE);
    this.assertCanCreate(dto.engineerId, user);
    const plannedHandoverAt = this.parseRequiredDate(
      dto.plannedHandoverAt,
      'plannedHandoverAt',
    );
    const expectedReturnAt = this.parseRequiredDate(
      dto.expectedReturnAt,
      'expectedReturnAt',
    );
    if (expectedReturnAt.getTime() < plannedHandoverAt.getTime()) {
      throw new BadRequestException(
        'expectedReturnAt must be after plannedHandoverAt',
      );
    }

    const [machine, customer, engineer] = await Promise.all([
      this.ensureMachine(dto.machineId),
      this.ensureCustomer(dto.customerId, user),
      this.ensureEngineer(dto.engineerId, user),
    ]);
    const participantIds = [...new Set(dto.participantEngineerIds ?? [])]
      .filter((id) => id !== engineer.id);
    if (participantIds.length && !isAdmin(user) && !isManager(user)) {
      throw new ForbiddenException('Only admin or manager can assign additional demo engineers');
    }
    const participants = await Promise.all(participantIds.map((id) => this.ensureEngineer(id, user)));

    if (
      machine.inventoryStatus !== MachineInventoryStatus.IN_STOCK &&
      machine.inventoryStatus !== MachineInventoryStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Only IN_STOCK or RETURNED machines can be assigned for demo',
      );
    }
    if (machine.demoPreparationStatus === DemoPreparationStatus.REQUIRED) {
      throw new BadRequestException(
        'Complete demo cleaning and repacking before reusing this machine',
      );
    }
    const returnedReadyForDemo =
      machine.inventoryStatus === MachineInventoryStatus.RETURNED &&
      machine.status === MachineStatus.REPAIRING;
    if (machine.status !== MachineStatus.ACTIVE && !returnedReadyForDemo) {
      throw new BadRequestException(
        'Only operational machines can be sent for demo',
      );
    }
    if (returnedReadyForDemo) {
      const [openRepair, openMaintenance, openDeviceService] =
        await Promise.all([
          this.prisma.repair.findFirst({
            where: {
              machineId: machine.id,
              status: {
                in: [RepairStatus.IN_PROGRESS, RepairStatus.WAITING_PARTS],
              },
            },
            select: { id: true },
          }),
          this.prisma.maintenance.findFirst({
            where: {
              machineId: machine.id,
              status: MaintenanceStatus.IN_PROGRESS,
            },
            select: { id: true },
          }),
          this.prisma.deviceServiceTicket.findFirst({
            where: {
              machineId: machine.id,
              status: DeviceServiceTicketStatus.RECEIVED,
            },
            select: { id: true },
          }),
        ]);
      if (openRepair || openMaintenance || openDeviceService) {
        throw new BadRequestException(
          'Finish the open service work before sending the machine for demo',
        );
      }
    }
    const expectedUse =
      machine.demoCategory === DemoMachineCategory.DEMO_UNIT
        ? DemoLoanMachineUse.DEMO_UNIT
        : machine.demoCategory === DemoMachineCategory.DEMO_USED
          ? DemoLoanMachineUse.DEMO_USED
          : null;
    if (expectedUse && dto.machineUse !== expectedUse) {
      throw new BadRequestException(
        'Demo category must match the machine record',
      );
    }
    if (
      !expectedUse &&
      dto.machineUse !== DemoLoanMachineUse.DEMO_UNIT &&
      dto.machineUse !== DemoLoanMachineUse.NEW_STOCK
    ) {
      throw new BadRequestException(
        'Choose dedicated demo machine or new stock for the first demo',
      );
    }

    const activeLoan = await this.prisma.demoLoan.findFirst({
      where: {
        machineId: machine.id,
        status: {
          in: [
            DemoLoanStatus.PLANNED,
            DemoLoanStatus.HANDED_OVER,
            DemoLoanStatus.OVERDUE,
          ],
        },
      },
      select: { code: true },
    });
    if (activeLoan) {
      throw new BadRequestException(
        `Machine already has active demo loan ${activeLoan.code}`,
      );
    }

    validateInventoryMovement(
      InventoryMovementType.RESERVE,
      machine.inventoryStatus,
      MachineInventoryStatus.RESERVED,
      customer.id,
    );

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateDemoLoanCode(tx);
      const loan = await tx.demoLoan.create({
        data: {
          code,
          ticketCode: ticketCode ?? code,
          status: DemoLoanStatus.PLANNED,
          machineUse: dto.machineUse,
          previousMachineDemoCategory: machine.demoCategory,
          machineId: machine.id,
          customerId: customer.id,
          engineerId: engineer.id,
          assignments: {
            create: [
              { engineerId: engineer.id, isLead: true },
              ...participants.map((participant) => ({ engineerId: participant.id, isLead: false })),
            ],
          },
          plannedHandoverAt,
          expectedReturnAt,
          handoverAddress:
            this.clean(dto.handoverAddress) ||
            customer.fullAddress ||
            customer.address ||
            null,
          receiverName:
            this.clean(dto.receiverName) || customer.contactPerson || null,
          receiverPosition:
            this.clean(dto.receiverPosition) ||
            customer.contactPosition ||
            null,
          receiverPhone:
            this.clean(dto.receiverPhone) ||
            customer.contactPhone ||
            customer.phone ||
            null,
          handoverCondition: this.clean(dto.handoverCondition),
          handoverAccessories: dto.handoverAccessories ?? Prisma.JsonNull,
          handoverNote: this.clean(dto.handoverNote),
          purpose: this.clean(dto.purpose),
        },
        include: this.defaultInclude(),
      });

      await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(tx),
          type: InventoryMovementType.RESERVE,
          machineId: machine.id,
          fromStatus: machine.inventoryStatus,
          toStatus: MachineInventoryStatus.RESERVED,
          occurredAt: plannedHandoverAt,
          note: `Demo loan ${loan.code}`,
          customerId: customer.id,
          createdById: user?.id || null,
        },
      });

      const machineUpdate = await tx.machine.updateMany({
        where: {
          id: machine.id,
          inventoryStatus: machine.inventoryStatus,
        },
        data: {
          inventoryStatus: MachineInventoryStatus.RESERVED,
          status: MachineStatus.ACTIVE,
          demoCategory:
            dto.machineUse === DemoLoanMachineUse.DEMO_UNIT
              ? DemoMachineCategory.DEMO_UNIT
              : dto.machineUse === DemoLoanMachineUse.NEW_STOCK
                ? DemoMachineCategory.DEMO_STOCK
                : DemoMachineCategory.DEMO_USED,
          customerId: customer.id,
          primaryEngineerId: engineer.id,
        },
      });
      if (machineUpdate.count !== 1) {
        throw new BadRequestException('Machine inventory status has changed');
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.CREATE,
          entityType: 'DemoLoan',
          entityId: loan.id,
          actor: user,
          metadata: {
            code: loan.code,
            status: loan.status,
            machineId: loan.machineId,
            customerId: loan.customerId,
            engineerId: loan.engineerId,
          },
        },
        tx,
      );

      return loan;
    });
  }

  async createBatch(dto: CreateDemoLoanBatchDto, user?: RequestUser) {
    if (dto.machines.length < 1) {
      throw new BadRequestException('Select at least one machine for demo');
    }
    const ids = dto.machines.map((item) => item.machineId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A machine can only be selected once');
    }
    const ticketCode = await this.prisma.$transaction((tx) =>
      this.generateDemoLoanCode(tx),
    );
    const created = [];
    for (const item of dto.machines) {
      created.push(await this.create({
        ...dto,
        machineId: item.machineId,
        machineUse: item.machineUse,
      }, user, ticketCode));
    }
    return { createdCount: created.length, loans: created };
  }

  async update(id: string, dto: UpdateDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_UPDATE);
    this.assertAdminOrManager(user);
    const current = await this.findOne(id, user);
    if (
      current.status === DemoLoanStatus.RETURNED ||
      current.status === DemoLoanStatus.CANCELLED
    ) {
      throw new BadRequestException('Closed demo loans cannot be edited');
    }
    if (
      current.status !== DemoLoanStatus.PLANNED &&
      dto.customerId !== undefined &&
      dto.customerId !== current.customerId
    ) {
      throw new BadRequestException(
        'Customer cannot be changed after the demo machine has been handed over',
      );
    }

    if (dto.machineId && dto.machineId !== current.machineId) {
      throw new BadRequestException(
        'Machine cannot be changed after demo loan is created',
      );
    }

    const customerId = dto.customerId ?? current.customerId;
    const engineerId = dto.engineerId ?? current.engineerId;
    const [customer, engineer] = await Promise.all([
      this.ensureCustomer(customerId, user),
      this.ensureEngineer(engineerId, user),
    ]);
    const plannedHandoverAt = dto.plannedHandoverAt
      ? this.parseRequiredDate(dto.plannedHandoverAt, 'plannedHandoverAt')
      : current.plannedHandoverAt;
    const expectedReturnAt = dto.expectedReturnAt
      ? this.parseRequiredDate(dto.expectedReturnAt, 'expectedReturnAt')
      : current.expectedReturnAt;
    if (expectedReturnAt.getTime() < plannedHandoverAt.getTime()) {
      throw new BadRequestException(
        'expectedReturnAt must be after plannedHandoverAt',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // A planned/active loan keeps its machine reserved for this customer and
      // engineer. Keep the machine assignment in sync when the ticket is edited.
      const machineUpdate = await tx.machine.updateMany({
        where: {
          id: current.machineId,
          inventoryStatus: MachineInventoryStatus.RESERVED,
        },
        data: { customerId: customer.id, primaryEngineerId: engineer.id },
      });
      if (machineUpdate.count !== 1) {
        throw new BadRequestException('Demo machine is no longer reserved');
      }

      const updated = await tx.demoLoan.update({
        where: { id },
        data: {
          customerId: customer.id,
          engineerId: engineer.id,
          plannedHandoverAt,
          expectedReturnAt,
          handedOverAt: dto.handedOverAt
            ? this.parseRequiredDate(dto.handedOverAt, 'handedOverAt')
            : undefined,
          handoverAddress: this.cleanPatch(dto.handoverAddress),
          receiverName: this.cleanPatch(dto.receiverName),
          receiverPosition: this.cleanPatch(dto.receiverPosition),
          receiverPhone: this.cleanPatch(dto.receiverPhone),
          handoverCondition: this.cleanPatch(dto.handoverCondition),
          handoverAccessories:
            dto.handoverAccessories === undefined
              ? undefined
              : dto.handoverAccessories,
          handoverNote: this.cleanPatch(dto.handoverNote),
          purpose: this.cleanPatch(dto.purpose),
        },
        include: this.defaultInclude(),
      });

      if (dto.engineerId !== undefined && dto.engineerId !== current.engineerId) {
        const retainedParticipants = current.assignments
          .filter((assignment) => assignment.engineerId !== current.engineerId && assignment.engineerId !== engineer.id)
          .map((assignment) => assignment.engineerId);
        await tx.demoLoanAssignment.deleteMany({ where: { demoLoanId: id } });
        await tx.demoLoanAssignment.createMany({
          data: [
            { demoLoanId: id, engineerId: engineer.id, isLead: true },
            ...retainedParticipants.map((engineerId) => ({ demoLoanId: id, engineerId, isLead: false })),
          ],
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.UPDATE,
          entityType: 'DemoLoan',
          entityId: id,
          actor: user,
          changes: {
            customerId: { from: current.customerId, to: updated.customerId },
            engineerId: { from: current.engineerId, to: updated.engineerId },
            plannedHandoverAt: {
              from: current.plannedHandoverAt,
              to: updated.plannedHandoverAt,
            },
            expectedReturnAt: {
              from: current.expectedReturnAt,
              to: updated.expectedReturnAt,
            },
          },
        },
        tx,
      );
      return updated;
    });
  }

  async handOver(id: string, dto: CompleteDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_STATUS_UPDATE);
    const current = await this.findOne(id, user);
    this.assertCanTouchStatus(current, user);
    if (current.status !== DemoLoanStatus.PLANNED) {
      throw new BadRequestException(
        'Only planned demo loans can be handed over',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const handedOverAt = dto.occurredAt
        ? this.parseRequiredDate(dto.occurredAt, 'occurredAt')
        : new Date();
      const updated = await tx.demoLoan.updateMany({
        where: { id, status: DemoLoanStatus.PLANNED },
        data: {
          status: DemoLoanStatus.HANDED_OVER,
          handedOverAt,
          handedOverById: user?.id ?? null,
          handoverCondition:
            this.clean(dto.condition) ?? current.handoverCondition,
          handoverAccessories:
            dto.accessories === undefined ? undefined : dto.accessories,
          handoverNote: this.clean(dto.note) ?? current.handoverNote,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Demo loan has already been handed over');
      }
      const loan = await tx.demoLoan.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });
      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'DemoLoan',
          entityId: id,
          actor: user,
          changes: {
            status: { from: current.status, to: loan.status },
            handedOverAt: { from: current.handedOverAt, to: handedOverAt },
          },
        },
        tx,
      );
      return loan;
    });
  }

  async returnLoan(id: string, dto: CompleteDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_STATUS_UPDATE);
    const current = await this.findOne(id, user);
    await this.assertCanReturn(current, user);
    const returnableStatuses: DemoLoanStatus[] = [
      DemoLoanStatus.HANDED_OVER,
      DemoLoanStatus.OVERDUE,
    ];
    if (!returnableStatuses.includes(current.status)) {
      throw new BadRequestException(
        'Only handed-over or overdue demo loans can be returned; cancel planned loans instead',
      );
    }

    const machine = await this.ensureMachine(current.machineId);
    const returnedAt = dto.occurredAt
      ? this.parseRequiredDate(dto.occurredAt, 'occurredAt')
      : new Date();
    validateInventoryMovement(
      InventoryMovementType.RETURN,
      machine.inventoryStatus,
      MachineInventoryStatus.RETURNED,
      current.customerId,
    );
    const needsPreparation =
      current.machineUse === DemoLoanMachineUse.NEW_STOCK ||
      current.machineUse === DemoLoanMachineUse.DEMO_USED ||
      Boolean(dto.requiresRepair);

    return this.prisma.$transaction(async (tx) => {
      const loanUpdate = await tx.demoLoan.updateMany({
        where: { id, status: { in: returnableStatuses } },
        data: {
          status: DemoLoanStatus.RETURNED,
          returnedAt,
          returnedById: user?.id ?? null,
          returnCondition: this.clean(dto.condition),
          returnAccessories:
            dto.accessories === undefined ? undefined : dto.accessories,
          returnNote: this.clean(dto.note),
          preparationStatus: needsPreparation
            ? DemoPreparationStatus.REQUIRED
            : DemoPreparationStatus.NOT_REQUIRED,
          returnRequiresRepair: dto.requiresRepair ?? false,
        },
      });
      if (loanUpdate.count !== 1) {
        throw new BadRequestException('Demo loan is already closed');
      }
      const loan = await tx.demoLoan.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });

      await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(tx),
          type: InventoryMovementType.RETURN,
          machineId: machine.id,
          fromStatus: machine.inventoryStatus,
          toStatus: MachineInventoryStatus.RETURNED,
          occurredAt: returnedAt,
          note: `Return demo loan ${loan.code}`,
          customerId: current.customerId,
          createdById: user?.id || null,
        },
      });

      const machineUpdate = await tx.machine.updateMany({
        where: {
          id: machine.id,
          inventoryStatus: machine.inventoryStatus,
        },
        data: {
          inventoryStatus: needsPreparation
            ? MachineInventoryStatus.RETURNED
            : MachineInventoryStatus.IN_STOCK,
          status: needsPreparation
            ? MachineStatus.REPAIRING
            : MachineStatus.ACTIVE,
          demoCategory:
            current.machineUse === DemoLoanMachineUse.NEW_STOCK
              ? DemoMachineCategory.DEMO_USED
              : undefined,
          demoPreparationStatus: needsPreparation
            ? DemoPreparationStatus.REQUIRED
            : DemoPreparationStatus.NOT_REQUIRED,
          customerId: null,
        },
      });
      if (machineUpdate.count !== 1) {
        throw new BadRequestException('Machine inventory status has changed');
      }
      if (!needsPreparation) {
        await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
            type: InventoryMovementType.ADJUST_STATUS,
            machineId: machine.id,
            fromStatus: MachineInventoryStatus.RETURNED,
            toStatus: MachineInventoryStatus.IN_STOCK,
            occurredAt: returnedAt,
            note: `Ready for demo after loan ${loan.code}`,
            createdById: user?.id || null,
          },
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'DemoLoan',
          entityId: id,
          actor: user,
          changes: {
            status: { from: current.status, to: loan.status },
            returnedAt: { from: current.returnedAt, to: returnedAt },
          },
          metadata: {
            machineId: machine.id,
            fromInventoryStatus: machine.inventoryStatus,
            toInventoryStatus: MachineInventoryStatus.RETURNED,
          },
        },
        tx,
      );

      return loan;
    });
  }

  async completePreparation(
    id: string,
    dto: CompleteDemoLoanDto,
    user?: RequestUser,
  ) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_STATUS_UPDATE);
    const current = await this.findOne(id, user);
    this.assertCanTouchStatus(current, user);
    if (
      current.status !== DemoLoanStatus.RETURNED ||
      current.preparationStatus !== DemoPreparationStatus.REQUIRED
    ) {
      throw new BadRequestException(
        'This returned machine does not need demo preparation',
      );
    }
    if (current.returnRequiresRepair) {
      const completedRepair = await this.prisma.repair.findFirst({
        where: {
          machineId: current.machineId,
          status: 'COMPLETED',
          completedAt: { gte: current.returnedAt ?? current.updatedAt },
        },
        select: { id: true },
      });
      if (!completedRepair) {
        throw new BadRequestException(
          'Complete a repair ticket before finalizing the returned machine',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.demoLoan.updateMany({
        where: {
          id,
          status: DemoLoanStatus.RETURNED,
          preparationStatus: DemoPreparationStatus.REQUIRED,
        },
        data: {
          preparationStatus: DemoPreparationStatus.COMPLETED,
          preparedAt: new Date(),
          preparationNote: this.clean(dto.note),
        },
      });
      if (updatedLoan.count !== 1) {
        throw new BadRequestException(
          'Demo preparation has already been completed',
        );
      }

      const updatedMachine = await tx.machine.updateMany({
        where: {
          id: current.machineId,
          demoPreparationStatus: DemoPreparationStatus.REQUIRED,
          inventoryStatus: MachineInventoryStatus.RETURNED,
        },
        data: {
          inventoryStatus: MachineInventoryStatus.IN_STOCK,
          demoPreparationStatus: DemoPreparationStatus.COMPLETED,
          status: MachineStatus.ACTIVE,
        },
      });
      if (updatedMachine.count !== 1) {
        throw new BadRequestException(
          'Machine preparation state has changed; refresh and try again',
        );
      }

      await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(tx),
          type: InventoryMovementType.ADJUST_STATUS,
          machineId: current.machineId,
          fromStatus: MachineInventoryStatus.RETURNED,
          toStatus: MachineInventoryStatus.IN_STOCK,
          occurredAt: new Date(),
          note: `Demo preparation completed ${current.code}`,
          createdById: user?.id || null,
        },
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'DemoLoan',
          entityId: id,
          actor: user,
          changes: {
            preparationStatus: {
              from: DemoPreparationStatus.REQUIRED,
              to: DemoPreparationStatus.COMPLETED,
            },
            preparationNote: {
              from: null,
              to: this.clean(dto.note),
            },
          },
          metadata: { machineId: current.machineId },
        },
        tx,
      );

      return tx.demoLoan.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });
    });
  }

  async cancel(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_UPDATE);
    this.assertAdminOrManager(user);
    const current = await this.findOne(id, user);
    if (
      current.status === DemoLoanStatus.RETURNED ||
      current.status === DemoLoanStatus.CANCELLED
    ) {
      throw new BadRequestException('Demo loan is already closed');
    }
    if (current.status !== DemoLoanStatus.PLANNED) {
      throw new BadRequestException(
        'Only planned demo loans can be cancelled; return a handed-over machine instead',
      );
    }
    const machine = await this.ensureMachine(current.machineId);

    return this.prisma.$transaction(async (tx) => {
      const loanUpdate = await tx.demoLoan.updateMany({
        where: { id, status: current.status },
        data: { status: DemoLoanStatus.CANCELLED },
      });
      if (loanUpdate.count !== 1) {
        throw new BadRequestException('Demo loan has already been closed');
      }
      const loan = await tx.demoLoan.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });

      if (machine.inventoryStatus === MachineInventoryStatus.RESERVED) {
        const restoreInventoryStatus = await this.getReservationSourceStatus(
          tx,
          machine.id,
          loan.code,
        );
        await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
            type: InventoryMovementType.ADJUST_STATUS,
            machineId: machine.id,
            fromStatus: MachineInventoryStatus.RESERVED,
            toStatus: restoreInventoryStatus,
            occurredAt: new Date(),
            note: `Cancel demo loan ${loan.code}`,
            customerId: current.customerId,
            createdById: user?.id || null,
          },
        });
        const machineUpdate = await tx.machine.updateMany({
          where: {
            id: machine.id,
            inventoryStatus: MachineInventoryStatus.RESERVED,
          },
          data: {
            inventoryStatus: restoreInventoryStatus,
            status:
              restoreInventoryStatus === MachineInventoryStatus.RETURNED
                ? MachineStatus.REPAIRING
                : MachineStatus.ACTIVE,
            demoCategory: current.previousMachineDemoCategory,
            customerId: null,
            primaryEngineerId: null,
          },
        });
        if (machineUpdate.count !== 1) {
          throw new BadRequestException('Machine inventory status has changed');
        }
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'DemoLoan',
          entityId: id,
          actor: user,
          changes: {
            status: { from: current.status, to: loan.status },
          },
          metadata: { machineId: current.machineId },
        },
        tx,
      );

      return loan;
    });
  }

  async remove(id: string, user: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_DELETE);
    if (!isAdmin(user))
      throw new ForbiddenException('Only administrators can delete demo loans');
    return this.cancel(id, user);
  }

  getStatuses() {
    return Object.values(DemoLoanStatus);
  }

  private async buildWhere(
    query: ListDemoLoansQueryDto,
    user?: RequestUser,
  ): Promise<Prisma.DemoLoanWhereInput> {
    const where: Prisma.DemoLoanWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.preparationStatus)
      where.preparationStatus = query.preparationStatus;
    if (query.customerId) where.customerId = query.customerId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.engineerId && (isAdmin(user) || isManager(user)))
      where.engineerId = query.engineerId;
    if (query.productIndustryId) {
      where.machine = {
        businessLine: {
          productIndustryId: query.productIndustryId,
        },
      };
    }
    if (query.from || query.to) {
      where.plannedHandoverAt = {
        gte: query.from
          ? this.parseRequiredDate(query.from, 'from')
          : undefined,
        lte: query.to
          ? this.endOfDay(this.parseRequiredDate(query.to, 'to'))
          : undefined,
      };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      const searchConditions: Prisma.DemoLoanWhereInput[] = [
        { code: { contains: search } },
        { purpose: { contains: search } },
        { receiverName: { contains: search } },
        { receiverPhone: { contains: search } },
        { customer: { name: { contains: search } } },
        { machine: { machineCode: { contains: search } } },
        { machine: { serialNumber: { contains: search } } },
        { machine: { modelName: { contains: search } } },
      ];
      const matchingLoans = await this.prisma.demoLoan.findMany({
        where: {
          AND: [demoLoanAccessWhere(user), where, { OR: searchConditions }],
        },
        select: { ticketCode: true },
        distinct: ['ticketCode'],
      });
      const ticketCodes = matchingLoans
        .map((loan) => loan.ticketCode)
        .filter((ticketCode): ticketCode is string => Boolean(ticketCode));
      where.OR = [
        ...searchConditions,
        { ticketCode: { contains: search } },
        ...(ticketCodes.length ? [{ ticketCode: { in: ticketCodes } }] : []),
      ];
    }
    return where;
  }

  private async refreshOverdueLoans() {
    await this.prisma.demoLoan.updateMany({
      where: {
        status: DemoLoanStatus.HANDED_OVER,
        expectedReturnAt: { lt: new Date() },
      },
      data: { status: DemoLoanStatus.OVERDUE },
    });
  }

  private assertAdminOrManager(user?: RequestUser) {
    if (!isAdmin(user) && !isManager(user)) {
      throw new ForbiddenException(
        'Only admin or manager can manage demo loans',
      );
    }
  }

  private assertCanCreate(engineerId: string, user?: RequestUser) {
    if (isAdmin(user) || isManager(user)) return;
    if (isEngineer(user) && user?.id === engineerId) return;
    throw new ForbiddenException(
      'Engineers can only create demo tickets assigned to themselves',
    );
  }

  private assertCanTouchStatus(
    loan: { engineerId: string; assignments?: Array<{ engineerId: string }> },
    user?: RequestUser,
  ) {
    if (isAdmin(user) || isManager(user)) return;
    if (
      isEngineer(user) &&
      (user?.id === loan.engineerId ||
        loan.assignments?.some((assignment) => assignment.engineerId === user.id))
    ) return;
    throw new ForbiddenException(
      'Only assigned engineer can update this demo loan',
    );
  }

  private async assertCanReturn(
    loan: { engineerId: string; assignments?: Array<{ engineerId: string }>; machineId: string },
    user?: RequestUser,
  ) {
    if (isAdmin(user) || isManager(user)) return;
    if (!isEngineer(user)) {
      throw new ForbiddenException('Only technical engineers can return demo machines');
    }
    if (
      user.id === loan.engineerId ||
      loan.assignments?.some((assignment) => assignment.engineerId === user.id)
    ) return;
    throw new ForbiddenException('Only assigned engineers can return demo machines');
  }

  private async ensureMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        businessLine: { include: { productIndustry: true } },
        customer: true,
      },
    });
    if (!machine) throw new BadRequestException('Machine does not exist');
    return machine;
  }

  private async ensureCustomer(customerId: string, user?: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new BadRequestException('Customer does not exist');
    if (
      (isAdmin(user) || isManager(user)) &&
      customer.regionId !== user?.regionId
    ) {
      throw new ForbiddenException('Customer is outside your region');
    }
    return customer;
  }

  private async ensureEngineer(engineerId: string, user?: RequestUser) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: { role: true },
    });
    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist');
    }
    if (!['engineer', 'admin'].includes(engineer.role.name)) {
      throw new BadRequestException('Demo loans can only be assigned to technical engineers');
    }
    if (
      (isAdmin(user) || isManager(user)) &&
      engineer.regionId !== user?.regionId
    ) {
      throw new ForbiddenException('Engineer is outside your region');
    }
    return engineer;
  }

  private async generateDemoLoanCode(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `DM-${year}`;
    return sequenceCode(tx, 'demo', prefix, 4, false);
  }

  private async generateMovementCode(tx: Prisma.TransactionClient) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `INV-${year}${month}${day}`;
    return sequenceCode(tx, 'inventory', prefix, 4, false);
  }

  private async getReservationSourceStatus(
    tx: Prisma.TransactionClient,
    machineId: string,
    demoLoanCode: string,
  ) {
    const reservation = await tx.machineInventoryMovement.findFirst({
      where: {
        machineId,
        type: InventoryMovementType.RESERVE,
        toStatus: MachineInventoryStatus.RESERVED,
        note: `Demo loan ${demoLoanCode}`,
      },
      orderBy: { occurredAt: 'desc' },
      select: { fromStatus: true },
    });

    return reservation?.fromStatus ?? MachineInventoryStatus.IN_STOCK;
  }

  private defaultInclude() {
    return {
      customer: {
        select: {
          id: true,
          name: true,
          hospitalName: true,
          province: true,
          fullAddress: true,
          address: true,
          contactPerson: true,
          contactPosition: true,
          contactPhone: true,
        },
      },
      engineer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      assignments: {
        include: { engineer: { select: { id: true, fullName: true, email: true, phone: true } } },
        orderBy: [{ isLead: 'desc' }, { assignedAt: 'asc' }],
      },
      handedOverBy: { select: { id: true, fullName: true, email: true } },
      returnedBy: { select: { id: true, fullName: true, email: true } },
      machine: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              hospitalName: true,
              province: true,
            },
          },
          businessLine: { include: { productIndustry: true } },
          machineModel: true,
        },
      },
    } satisfies Prisma.DemoLoanInclude;
  }

  private parseRequiredDate(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return date;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  private clean(value?: string | null) {
    return value?.trim() || null;
  }

  private cleanPatch(value?: string | null) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }
}
