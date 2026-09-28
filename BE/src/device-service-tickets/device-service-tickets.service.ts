import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceServiceTicketStatus,
  MachineStatus,
  Prisma,
  WorkTaskKind,
} from '@prisma/client';
import {
  deviceServiceTicketAccessWhere,
  isAdmin,
  isEngineer,
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
  constructor(private readonly prisma: PrismaService, private readonly auditLogsService: AuditLogsService) {}

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
    if (!isAdmin(user)) throw new ForbiddenException('Only administrators can delete device service tickets');
    const ticket = await this.findOne(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.deviceServiceTicket.delete({ where: { id } });
      if (ticket.machineId && ticket.machine) {
        await reconcileMachineStatusFromOpenWork(tx, ticket.machineId, ticket.machine.inventoryStatus);
      }
      await this.auditLogsService.create({
        action: AUDIT_ACTIONS.DELETE,
        entityType: 'DeviceServiceTicket',
        entityId: id,
        actor: user,
        metadata: { receiveCode: ticket.receiveCode, returnCode: ticket.returnCode, machineId: ticket.machineId, status: ticket.status },
      }, tx);
    });
    return { deleted: true };
  }

  async create(dto: CreateDeviceServiceTicketDto, user?: RequestUser) {
    const receivedAt = this.parseDate(dto.receivedAt) ?? new Date();
    const machine = dto.machineId
      ? await this.prisma.machine.findUnique({
          where: { id: dto.machineId },
          include: { customer: true, machineModel: true },
        })
      : null;
    if (dto.machineId && !machine)
      throw new BadRequestException('Machine not found');

    const customer = dto.customerId
      ? await this.prisma.customer.findUnique({ where: { id: dto.customerId } })
      : (machine?.customer ?? null);
    if (dto.customerId && !customer)
      throw new BadRequestException('Customer not found');

    const engineerId = isEngineer(user)
      ? (user?.id ?? null)
      : dto.engineerId || user?.id || null;

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
        await tx.machine.update({
          where: { id: machine.id },
          data: {
            status: MachineStatus.REPAIRING,
            primaryEngineerId: engineerId || undefined,
          },
        });
      }

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
        await reconcileMachineStatusFromOpenWork(
          tx,
          current.machine.id,
          current.machine.inventoryStatus,
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

      return tx.deviceServiceTicket.findUnique({
        where: { id },
        include: this.defaultInclude(),
      });
    });
  }

  getStatuses() {
    return Object.values(DeviceServiceTicketStatus);
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
