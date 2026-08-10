import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DemoLoanStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
} from '@prisma/client';
import { demoLoanAccessWhere, isAdmin, isEngineer, isManager } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateInventoryMovement } from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteDemoLoanDto } from './dto/complete-demo-loan.dto';
import { CreateDemoLoanDto } from './dto/create-demo-loan.dto';
import { ListDemoLoansQueryDto } from './dto/list-demo-loans-query.dto';
import { UpdateDemoLoanDto } from './dto/update-demo-loan.dto';

@Injectable()
export class DemoLoansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListDemoLoansQueryDto, user?: RequestUser): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DemoLoanWhereInput = {
      AND: [demoLoanAccessWhere(user), this.buildWhere(query, user)],
    };

    await this.refreshOverdueLoans(user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.demoLoan.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ expectedReturnAt: 'asc' }, { plannedHandoverAt: 'desc' }],
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
    const item = await this.prisma.demoLoan.findFirst({
      where: { AND: [{ id }, demoLoanAccessWhere(user)] },
      include: this.defaultInclude(),
    });
    if (!item) throw new NotFoundException('Demo loan not found');
    return item;
  }

  async create(dto: CreateDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_CREATE);
    this.assertCanCreate(dto.engineerId, user);
    const plannedHandoverAt = this.parseRequiredDate(dto.plannedHandoverAt, 'plannedHandoverAt');
    const expectedReturnAt = this.parseRequiredDate(dto.expectedReturnAt, 'expectedReturnAt');
    if (expectedReturnAt.getTime() < plannedHandoverAt.getTime()) {
      throw new BadRequestException('expectedReturnAt must be after plannedHandoverAt');
    }

    const [machine, customer, engineer] = await Promise.all([
      this.ensureMachine(dto.machineId),
      this.ensureCustomer(dto.customerId, user),
      this.ensureEngineer(dto.engineerId, user),
    ]);

    if (machine.inventoryStatus !== MachineInventoryStatus.IN_STOCK && machine.inventoryStatus !== MachineInventoryStatus.RETURNED) {
      throw new BadRequestException('Only IN_STOCK or RETURNED machines can be assigned for demo');
    }

    const activeLoan = await this.prisma.demoLoan.findFirst({
      where: {
        machineId: machine.id,
        status: { in: [DemoLoanStatus.PLANNED, DemoLoanStatus.HANDED_OVER, DemoLoanStatus.OVERDUE] },
      },
      select: { code: true },
    });
    if (activeLoan) {
      throw new BadRequestException(`Machine already has active demo loan ${activeLoan.code}`);
    }

    validateInventoryMovement(
      InventoryMovementType.RESERVE,
      machine.inventoryStatus,
      MachineInventoryStatus.RESERVED,
      customer.id,
    );

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.demoLoan.create({
        data: {
          code: await this.generateDemoLoanCode(tx),
          status: DemoLoanStatus.PLANNED,
          machineId: machine.id,
          customerId: customer.id,
          engineerId: engineer.id,
          plannedHandoverAt,
          expectedReturnAt,
          handoverAddress: this.clean(dto.handoverAddress) || customer.fullAddress || customer.address || null,
          receiverName: this.clean(dto.receiverName) || customer.contactPerson || null,
          receiverPosition: this.clean(dto.receiverPosition) || customer.contactPosition || null,
          receiverPhone: this.clean(dto.receiverPhone) || customer.contactPhone || customer.phone || null,
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

      await tx.machine.update({
        where: { id: machine.id },
        data: {
          inventoryStatus: MachineInventoryStatus.RESERVED,
          status: MachineStatus.ACTIVE,
          customerId: customer.id,
          primaryEngineerId: engineer.id,
        },
      });

      return loan;
    });
  }

  async update(id: string, dto: UpdateDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_UPDATE);
    this.assertAdminOrManager(user);
    const current = await this.findOne(id, user);
    if (current.status === DemoLoanStatus.RETURNED || current.status === DemoLoanStatus.CANCELLED) {
      throw new BadRequestException('Closed demo loans cannot be edited');
    }

    if (dto.machineId && dto.machineId !== current.machineId) {
      throw new BadRequestException('Machine cannot be changed after demo loan is created');
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
      throw new BadRequestException('expectedReturnAt must be after plannedHandoverAt');
    }

    return this.prisma.demoLoan.update({
      where: { id },
      data: {
        customerId: customer.id,
        engineerId: engineer.id,
        plannedHandoverAt,
        expectedReturnAt,
        handedOverAt: dto.handedOverAt ? this.parseRequiredDate(dto.handedOverAt, 'handedOverAt') : undefined,
        handoverAddress: this.cleanPatch(dto.handoverAddress),
        receiverName: this.cleanPatch(dto.receiverName),
        receiverPosition: this.cleanPatch(dto.receiverPosition),
        receiverPhone: this.cleanPatch(dto.receiverPhone),
        handoverCondition: this.cleanPatch(dto.handoverCondition),
        handoverAccessories: dto.handoverAccessories === undefined ? undefined : dto.handoverAccessories,
        handoverNote: this.cleanPatch(dto.handoverNote),
        purpose: this.cleanPatch(dto.purpose),
      },
      include: this.defaultInclude(),
    });
  }

  async handOver(id: string, dto: CompleteDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_STATUS_UPDATE);
    const current = await this.findOne(id, user);
    this.assertCanTouchStatus(current.engineerId, user);
    if (current.status !== DemoLoanStatus.PLANNED) {
      throw new BadRequestException('Only planned demo loans can be handed over');
    }

    return this.prisma.demoLoan.update({
      where: { id },
      data: {
        status: DemoLoanStatus.HANDED_OVER,
        handedOverAt: dto.occurredAt ? this.parseRequiredDate(dto.occurredAt, 'occurredAt') : new Date(),
        handoverCondition: this.clean(dto.condition) ?? current.handoverCondition,
        handoverAccessories: dto.accessories === undefined ? undefined : dto.accessories,
        handoverNote: this.clean(dto.note) ?? current.handoverNote,
      },
      include: this.defaultInclude(),
    });
  }

  async returnLoan(id: string, dto: CompleteDemoLoanDto, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_STATUS_UPDATE);
    const current = await this.findOne(id, user);
    this.assertCanTouchStatus(current.engineerId, user);
    const returnableStatuses: DemoLoanStatus[] = [
      DemoLoanStatus.HANDED_OVER,
      DemoLoanStatus.OVERDUE,
      DemoLoanStatus.PLANNED,
    ];
    if (!returnableStatuses.includes(current.status)) {
      throw new BadRequestException('Demo loan is already closed');
    }

    const machine = await this.ensureMachine(current.machineId);
    const returnedAt = dto.occurredAt ? this.parseRequiredDate(dto.occurredAt, 'occurredAt') : new Date();
    validateInventoryMovement(
      InventoryMovementType.RETURN,
      machine.inventoryStatus,
      MachineInventoryStatus.RETURNED,
      current.customerId,
    );

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.demoLoan.update({
        where: { id },
        data: {
          status: DemoLoanStatus.RETURNED,
          returnedAt,
          returnCondition: this.clean(dto.condition),
          returnAccessories: dto.accessories === undefined ? undefined : dto.accessories,
          returnNote: this.clean(dto.note),
        },
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

      await tx.machine.update({
        where: { id: machine.id },
        data: {
          inventoryStatus: MachineInventoryStatus.RETURNED,
          status: MachineStatus.REPAIRING,
          customerId: null,
        },
      });

      return loan;
    });
  }

  async cancel(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_UPDATE);
    this.assertAdminOrManager(user);
    const current = await this.findOne(id, user);
    if (current.status === DemoLoanStatus.RETURNED || current.status === DemoLoanStatus.CANCELLED) {
      throw new BadRequestException('Demo loan is already closed');
    }
    const machine = await this.ensureMachine(current.machineId);

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.demoLoan.update({
        where: { id },
        data: { status: DemoLoanStatus.CANCELLED },
        include: this.defaultInclude(),
      });

      if (machine.inventoryStatus === MachineInventoryStatus.RESERVED) {
        await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
            type: InventoryMovementType.ADJUST_STATUS,
            machineId: machine.id,
            fromStatus: MachineInventoryStatus.RESERVED,
            toStatus: MachineInventoryStatus.IN_STOCK,
            occurredAt: new Date(),
            note: `Cancel demo loan ${loan.code}`,
            customerId: current.customerId,
            createdById: user?.id || null,
          },
        });
        await tx.machine.update({
          where: { id: machine.id },
          data: { inventoryStatus: MachineInventoryStatus.IN_STOCK, status: MachineStatus.ACTIVE, customerId: null },
        });
      }

      return loan;
    });
  }

  async remove(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.DEMO_LOAN_DELETE);
    this.assertAdminOrManager(user);
    const current = await this.findOne(id, user);
    if (current.status !== DemoLoanStatus.CANCELLED) {
      throw new BadRequestException('Only cancelled demo loans can be deleted');
    }
    await this.prisma.demoLoan.delete({ where: { id } });
    return { ok: true };
  }

  getStatuses() {
    return Object.values(DemoLoanStatus);
  }

  private buildWhere(query: ListDemoLoansQueryDto, user?: RequestUser): Prisma.DemoLoanWhereInput {
    const where: Prisma.DemoLoanWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.engineerId && (isAdmin(user) || isManager(user))) where.engineerId = query.engineerId;
    if (query.productIndustryId) {
      where.machine = {
        businessLine: {
          productIndustryId: query.productIndustryId,
        },
      };
    }
    if (query.from || query.to) {
      where.plannedHandoverAt = {
        gte: query.from ? this.parseRequiredDate(query.from, 'from') : undefined,
        lte: query.to ? this.endOfDay(this.parseRequiredDate(query.to, 'to')) : undefined,
      };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search } },
        { purpose: { contains: search } },
        { receiverName: { contains: search } },
        { receiverPhone: { contains: search } },
        { customer: { name: { contains: search } } },
        { machine: { machineCode: { contains: search } } },
        { machine: { serialNumber: { contains: search } } },
        { machine: { modelName: { contains: search } } },
      ];
    }
    return where;
  }

  private async refreshOverdueLoans(user?: RequestUser) {
    if (!isAdmin(user) && !isManager(user)) return;
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
      throw new ForbiddenException('Only admin or manager can manage demo loans');
    }
  }

  private assertCanCreate(engineerId: string, user?: RequestUser) {
    if (isAdmin(user) || isManager(user)) return;
    if (isEngineer(user) && user?.id === engineerId) return;
    throw new ForbiddenException('Engineers can only create demo tickets assigned to themselves');
  }

  private assertCanTouchStatus(engineerId: string, user?: RequestUser) {
    if (isAdmin(user) || isManager(user)) return;
    if (isEngineer(user) && user?.id === engineerId) return;
    throw new ForbiddenException('Only assigned engineer can update this demo loan');
  }

  private async ensureMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: { businessLine: { include: { productIndustry: true } }, customer: true },
    });
    if (!machine) throw new BadRequestException('Machine does not exist');
    return machine;
  }

  private async ensureCustomer(customerId: string, user?: RequestUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new BadRequestException('Customer does not exist');
    if ((isAdmin(user) || isManager(user)) && customer.regionId !== user?.regionId) {
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
    if ((isAdmin(user) || isManager(user)) && engineer.regionId !== user?.regionId) {
      throw new ForbiddenException('Engineer is outside your region');
    }
    return engineer;
  }

  private async generateDemoLoanCode(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `DM-${year}`;
    const latest = await tx.demoLoan.findFirst({
      where: { code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const latestNumber = latest?.code ? Number(latest.code.slice(prefix.length + 1)) : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  private async generateMovementCode(tx: Prisma.TransactionClient) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `INV-${year}${month}${day}`;
    const latest = await tx.machineInventoryMovement.findFirst({
      where: { code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const latestNumber = latest?.code ? Number(latest.code.slice(prefix.length + 1)) : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
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
      machine: {
        include: {
          customer: { select: { id: true, name: true, hospitalName: true, province: true } },
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
