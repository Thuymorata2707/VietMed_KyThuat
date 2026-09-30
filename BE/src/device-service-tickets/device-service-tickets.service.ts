import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceServiceTicketStatus,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
  WorkTaskKind,
} from '@prisma/client';
import {
  customerAccessWhere,
  deviceServiceTicketAccessWhere,
  isAdmin,
  isEngineer,
  machineAccessWhere,
} from '../auth/access-scope';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { replaceWorkUsedParts } from '../common/work-used-parts';
import { reconcileMachineStatusFromOpenWork } from '../common/machine-work-status';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { CreateDeviceServiceTicketDto } from './dto/create-device-service-ticket.dto';
import { ListDeviceServiceTicketsQueryDto } from './dto/list-device-service-tickets-query.dto';
import { ReturnDeviceServiceTicketDto } from './dto/return-device-service-ticket.dto';

@Injectable()
export class DeviceServiceTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(
    query: ListDeviceServiceTicketsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DeviceServiceTicketWhereInput = {
      AND: [deviceServiceTicketAccessWhere(user), this.buildWhere(query)],
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.deviceServiceTicket.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deviceServiceTicket.count({ where }),
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
    const item = await this.prisma.deviceServiceTicket.findFirst({
      where: {
        AND: [{ id }, deviceServiceTicketAccessWhere(user)],
      },
      include: this.defaultInclude(),
    });
    if (!item) throw new NotFoundException('Device service ticket not found');
    return item;
  }

  async remove(id: string, user: RequestUser) {
    assertPermission(user, PERMISSIONS.DEVICE_SERVICE_DELETE);
    if (!isAdmin(user))
      throw new ForbiddenException(
        'Only administrators can delete device service tickets',
      );
    const ticket = await this.findOne(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.deviceServiceTicket.delete({ where: { id } });
      if (ticket.machineId && ticket.machine) {
        await reconcileMachineStatusFromOpenWork(
          tx,
          ticket.machineId,
          ticket.machine.inventoryStatus,
        );
      }
      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'DeviceServiceTicket',
          entityId: id,
          actor: user,
          metadata: {
            receiveCode: ticket.receiveCode,
            returnCode: ticket.returnCode,
            machineId: ticket.machineId,
            status: ticket.status,
          },
        },
        tx,
      );
    });
    return { deleted: true };
  }

  async create(dto: CreateDeviceServiceTicketDto, user?: RequestUser) {
    const receivedAt = this.parseDate(dto.receivedAt) ?? new Date();
    const machine = dto.machineId
      ? await this.prisma.machine.findFirst({
          where: {
            AND: [{ id: dto.machineId }, machineAccessWhere(user)],
          },
          include: {
            customer: true,
            machineModel: {
              include: {
                businessLine: { include: { productIndustry: true } },
              },
            },
            businessLine: { include: { productIndustry: true } },
          },
        })
      : null;
    if (dto.machineId && !machine) {
      throw new NotFoundException('Machine not found or outside your access');
    }
    if (
      machine &&
      machine.inventoryStatus !== MachineInventoryStatus.INSTALLED &&
      machine.inventoryStatus !== MachineInventoryStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Only installed or returned machines can be received for service',
      );
    }

    const customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          where: {
            AND: [{ id: dto.customerId }, customerAccessWhere(user)],
          },
        })
      : (machine?.customer ?? null);
    if (dto.customerId && !customer) {
      throw new NotFoundException('Customer not found or outside your access');
    }

    if (
      machine?.customerId &&
      customer?.id &&
      machine.customerId !== customer.id
    ) {
      throw new BadRequestException('Customer does not match selected machine');
    }

    const engineerId = isEngineer(user)
      ? (user?.id ?? null)
      : dto.engineerId || null;
    if (engineerId) await this.ensureEngineer(engineerId);
    if (machine && user && isEngineer(user)) {
      await this.assertEngineerCanUseMachine(machine, user);
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.deviceServiceTicket.create({
        data: {
          receiveCode: await this.generateCode(
            tx,
            'PNTB',
            receivedAt,
            'receiveCode',
          ),
          status: DeviceServiceTicketStatus.RECEIVED,
          customerId: customer?.id ?? null,
          engineerId,
          machineId: machine?.id ?? null,
          receivedAt,
          usingDepartment:
            this.clean(dto.usingDepartment) || customer?.name || null,
          representative:
            this.clean(dto.representative) || customer?.contactPerson || null,
          representativePosition:
            this.clean(dto.representativePosition) ||
            customer?.contactPosition ||
            null,
          contactPhone:
            this.clean(dto.contactPhone) ||
            customer?.contactPhone ||
            customer?.phone ||
            null,
          address:
            this.clean(dto.address) ||
            customer?.fullAddress ||
            customer?.address ||
            null,
          deviceName:
            this.clean(dto.deviceName) ||
            machine?.name ||
            machine?.modelName ||
            null,
          modelName:
            this.clean(dto.modelName) ||
            machine?.modelName ||
            machine?.machineModel?.displayName ||
            machine?.machineModel?.name ||
            null,
          serialNumber:
            this.clean(dto.serialNumber) || machine?.serialNumber || null,
          warrantyStatus: this.clean(dto.warrantyStatus),
          warrantyTerm: this.clean(dto.warrantyTerm),
          receivedCondition: this.clean(dto.receivedCondition),
          receivedAccessories: this.clean(dto.receivedAccessories),
          preliminaryCause: this.clean(dto.preliminaryCause),
          note: this.clean(dto.note),
          createdById: user?.id || null,
        },
        include: this.defaultInclude(),
      });

      if (machine) {
        const machineUpdate = await tx.machine.updateMany({
          where: {
            id: machine.id,
            inventoryStatus: machine.inventoryStatus,
          },
          data: {
            status: MachineStatus.REPAIRING,
            primaryEngineerId: engineerId || undefined,
          },
        });
        if (machineUpdate.count !== 1) {
          throw new BadRequestException('Machine status has changed');
        }
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.CREATE,
          entityType: 'DeviceServiceTicket',
          entityId: ticket.id,
          actor: user,
          metadata: {
            receiveCode: ticket.receiveCode,
            machineId: ticket.machineId,
            customerId: ticket.customerId,
            engineerId: ticket.engineerId,
            status: ticket.status,
          },
        },
        tx,
      );

      return ticket;
    });
  }

  async returnDevice(
    id: string,
    dto: ReturnDeviceServiceTicketDto,
    user?: RequestUser,
  ) {
    const current = await this.prisma.deviceServiceTicket.findFirst({
      where: {
        AND: [{ id }, deviceServiceTicketAccessWhere(user)],
      },
      include: { machine: true },
    });
    if (!current)
      throw new NotFoundException('Device service ticket not found');
    if (current.status !== DeviceServiceTicketStatus.RECEIVED) {
      throw new BadRequestException('Only received devices can be returned');
    }

    const returnedAt = this.parseDate(dto.returnedAt) ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.deviceServiceTicket.updateMany({
        where: { id, status: DeviceServiceTicketStatus.RECEIVED },
        data: {
          returnCode: await this.generateCode(
            tx,
            'PTTB',
            returnedAt,
            'returnCode',
          ),
          status: DeviceServiceTicketStatus.RETURNED,
          returnedAt,
          repairMethod: this.clean(dto.repairMethod),
          repairCostItems: this.clean(dto.repairCostItems),
          resultNote: this.clean(dto.resultNote),
          returnCondition: this.clean(dto.returnCondition),
          totalRepairCost: this.clean(dto.totalRepairCost),
          repairCostInWords: this.clean(dto.repairCostInWords),
          note: this.clean(dto.note) ?? current.note,
        },
      });
      if (updatedTicket.count !== 1) {
        throw new BadRequestException(
          'Device service ticket has already been returned',
        );
      }

      if (dto.usedParts !== undefined) {
        await replaceWorkUsedParts({
          actor: user!,
          customerId: current.customerId,
          machineId: current.machineId,
          owner: {
            id,
            kind: WorkTaskKind.DEVICE_SERVICE,
            field: 'deviceServiceTicketId',
          },
          parts: dto.usedParts,
          prisma: this.prisma,
          tx,
        });
      }

      if (current.machine) {
        const machineStatus = await reconcileMachineStatusFromOpenWork(
          tx,
          current.machine.id,
          current.machine.inventoryStatus,
        );

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.STATUS_CHANGE,
            entityType: 'DeviceServiceTicket',
            entityId: id,
            actor: user,
            changes: {
              status: {
                from: current.status,
                to: DeviceServiceTicketStatus.RETURNED,
              },
            },
            metadata: {
              machineId: current.machine.id,
              machineStatus,
            },
          },
          tx,
        );
      } else {
        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.STATUS_CHANGE,
            entityType: 'DeviceServiceTicket',
            entityId: id,
            actor: user,
            changes: {
              status: {
                from: current.status,
                to: DeviceServiceTicketStatus.RETURNED,
              },
            },
          },
          tx,
        );
      }

      return tx.deviceServiceTicket.findUnique({
        where: { id },
        include: this.defaultInclude(),
      });
    });
  }

  async updateReturnDetails(
    id: string,
    dto: ReturnDeviceServiceTicketDto,
    user?: RequestUser,
  ) {
    const current = await this.prisma.deviceServiceTicket.findFirst({
      where: {
        AND: [{ id }, deviceServiceTicketAccessWhere(user)],
      },
      include: { machine: true },
    });
    if (!current)
      throw new NotFoundException('Device service ticket not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.deviceServiceTicket.update({
        where: { id },
        data: {
          returnedAt:
            dto.returnedAt === undefined
              ? undefined
              : (this.parseDate(dto.returnedAt) ?? current.returnedAt),
          repairMethod:
            dto.repairMethod === undefined
              ? undefined
              : this.clean(dto.repairMethod),
          repairCostItems:
            dto.repairCostItems === undefined
              ? undefined
              : this.clean(dto.repairCostItems),
          resultNote:
            dto.resultNote === undefined
              ? undefined
              : this.clean(dto.resultNote),
          returnCondition:
            dto.returnCondition === undefined
              ? undefined
              : this.clean(dto.returnCondition),
          totalRepairCost:
            dto.totalRepairCost === undefined
              ? undefined
              : this.clean(dto.totalRepairCost),
          repairCostInWords:
            dto.repairCostInWords === undefined
              ? undefined
              : this.clean(dto.repairCostInWords),
          note: dto.note === undefined ? undefined : this.clean(dto.note),
        },
        include: this.defaultInclude(),
      });

      if (dto.usedParts !== undefined) {
        await replaceWorkUsedParts({
          actor: user!,
          customerId: current.customerId,
          machineId: current.machineId,
          owner: {
            id,
            kind: WorkTaskKind.DEVICE_SERVICE,
            field: 'deviceServiceTicketId',
          },
          parts: dto.usedParts,
          prisma: this.prisma,
          tx,
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.UPDATE,
          entityType: 'DeviceServiceTicket',
          entityId: id,
          actor: user,
          metadata: {
            updatedFields: Object.keys(dto),
          },
        },
        tx,
      );

      return tx.deviceServiceTicket.findUnique({
        where: { id },
        include: this.defaultInclude(),
      });
    });
  }

  getStatuses() {
    return Object.values(DeviceServiceTicketStatus);
  }

  private async ensureEngineer(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: { role: true },
    });
    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist or is inactive');
    }
    if (engineer.role.name !== 'engineer' && engineer.role.name !== 'admin') {
      throw new BadRequestException('Assigned user must be an engineer');
    }
  }

  private async assertEngineerCanUseMachine(
    machine: {
      businessLine?: {
        expertiseGroup?: string | null;
        productIndustry?: { expertiseGroup?: string | null } | null;
      } | null;
      machineModel?: {
        businessLine?: {
          expertiseGroup?: string | null;
          productIndustry?: { expertiseGroup?: string | null } | null;
        } | null;
      } | null;
    },
    actor: RequestUser,
  ) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: { engineerProfile: true },
    });
    const expertiseGroup = engineer?.engineerProfile?.expertiseGroup;
    if (!expertiseGroup) return;

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

  async previewReceiveCode(date?: string) {
    return this.generateCode(
      this.prisma,
      'PNTB',
      this.parseDate(date) ?? new Date(),
      'receiveCode',
    );
  }

  private buildWhere(
    query: ListDeviceServiceTicketsQueryDto,
  ): Prisma.DeviceServiceTicketWhereInput {
    const search = query.search?.trim();
    return {
      status: this.parseStatus(query.status),
      engineerId: query.engineerId || undefined,
      OR: search
        ? [
            { receiveCode: { contains: search } },
            { returnCode: { contains: search } },
            { deviceName: { contains: search } },
            { modelName: { contains: search } },
            { serialNumber: { contains: search } },
            { usingDepartment: { contains: search } },
            { representative: { contains: search } },
            { customer: { name: { contains: search } } },
            { machine: { machineCode: { contains: search } } },
          ]
        : undefined,
    };
  }

  private defaultInclude() {
    return {
      customer: { include: { region: true } },
      engineer: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          region: true,
        },
      },
      machine: { include: { machineModel: true, customer: true } },
      createdBy: { select: { id: true, email: true, fullName: true } },
      usedParts: { orderBy: { createdAt: 'asc' as const } },
    };
  }

  private async generateCode(
    client: Prisma.TransactionClient | PrismaService,
    prefix: 'PNTB' | 'PTTB',
    date: Date,
    field: 'receiveCode' | 'returnCode',
  ) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const datePart = `${day}${month}${year}`;
    return sequenceCode(
      client,
      field === 'receiveCode' ? 'receive' : 'return',
      `${prefix}-${datePart}`,
      3,
      client === this.prisma,
    );
  }

  private parseDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    return date;
  }

  private parseStatus(value?: string) {
    if (!value) return undefined;
    if (
      !Object.values(DeviceServiceTicketStatus).includes(
        value as DeviceServiceTicketStatus,
      )
    ) {
      throw new BadRequestException('Invalid status');
    }
    return value as DeviceServiceTicketStatus;
  }

  private clean(value?: string | null) {
    return value?.trim() || null;
  }
}
