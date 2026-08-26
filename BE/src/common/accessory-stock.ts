import {
  AccessoryStockMovementType,
  Prisma,
  WorkTaskKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './request-user.type';

type AccessoryStockOwner = {
  id: string;
  kind: WorkTaskKind;
  field: 'repairId' | 'maintenanceId' | 'deviceServiceTicketId';
};

export async function replaceWorkAccessoryStockExports({
  actor,
  customerId,
  machineId,
  owner,
  parts,
  prisma,
  tx,
}: {
  actor: RequestUser;
  customerId?: string | null;
  machineId?: string | null;
  owner: AccessoryStockOwner;
  parts: Array<{
    componentAccessoryId?: string | null;
    name: string;
    note?: string | null;
    quantity: number;
    serialNumber?: string | null;
    unit?: string | null;
    unitCost?: number | null;
    unitPrice?: number | null;
  }>;
  prisma: PrismaService;
  tx: Prisma.TransactionClient;
}) {
  await tx.accessoryStockMovement.deleteMany({
    where: { [owner.field]: owner.id, type: AccessoryStockMovementType.EXPORT },
  });

  const stockParts = parts.filter(
    (part) => part.componentAccessoryId && Number(part.quantity || 0) > 0,
  );
  if (!stockParts.length) return;

  const occurredAt = new Date();
  for (const part of stockParts) {
    const quantity = Number(part.quantity || 0);
    const unitCost = part.unitCost === null || part.unitCost === undefined ? null : Number(part.unitCost);
    const unitPrice = part.unitPrice === null || part.unitPrice === undefined ? null : Number(part.unitPrice);

    await tx.accessoryStockMovement.create({
      data: {
        code: await generateAccessoryStockMovementCode(tx, occurredAt),
        type: AccessoryStockMovementType.EXPORT,
        componentAccessoryId: part.componentAccessoryId!,
        quantityDelta: -quantity,
        unit: part.unit || 'cái',
        serialNumber: part.serialNumber || null,
        unitCost,
        unitPrice,
        totalCost: unitCost === null ? null : quantity * unitCost,
        totalPrice: unitPrice === null ? null : quantity * unitPrice,
        reason: reasonForWorkKind(owner.kind),
        note: part.note || part.name,
        occurredAt,
        machineId: machineId || null,
        customerId: customerId || null,
        [owner.field]: owner.id,
        createdById: actor.id,
      },
    });
  }
}

export async function generateAccessoryStockMovementCode(
  client: Prisma.TransactionClient | PrismaService,
  date = new Date(),
) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `PK-${year}${month}${day}`;
  const latest = await client.accessoryStockMovement.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const latestNumber = latest?.code ? Number(latest.code.slice(prefix.length + 1)) : 0;
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

function reasonForWorkKind(kind: WorkTaskKind) {
  if (kind === WorkTaskKind.REPAIR) return 'Xuất thay thế phiếu sửa chữa';
  if (kind === WorkTaskKind.MAINTENANCE) return 'Xuất thay thế phiếu bảo trì';
  if (kind === WorkTaskKind.DEVICE_SERVICE) return 'Xuất thay thế phiếu nhận/trả thiết bị';
  return 'Xuất thay thế';
}
