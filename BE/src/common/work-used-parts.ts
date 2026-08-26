import { BadRequestException } from '@nestjs/common';
import { Prisma, WorkTaskKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './request-user.type';
import { UsedPartDto } from './dto/used-part.dto';
import { replaceWorkAccessoryStockExports } from './accessory-stock';

type WorkOwner = {
  id: string;
  kind: WorkTaskKind;
  field: 'repairId' | 'maintenanceId' | 'deviceServiceTicketId';
};

export async function replaceWorkUsedParts({
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
  machineId: string | null;
  owner: WorkOwner;
  parts: UsedPartDto[];
  prisma: PrismaService;
  tx: Prisma.TransactionClient;
}) {
  await tx.usedPart.deleteMany({ where: { [owner.field]: owner.id } });
  const normalized = await normalizeWorkUsedParts(prisma, parts, machineId);

  if (!normalized.length) {
    await replaceWorkAccessoryStockExports({
      actor,
      customerId,
      machineId,
      owner,
      parts: [],
      prisma,
      tx,
    });
    return;
  }

  await tx.usedPart.createMany({
    data: normalized.map((part) => ({
      kind: owner.kind,
      [owner.field]: owner.id,
      name: part.name,
      quantity: part.quantity,
      unit: part.unit,
      serialNumber: part.serialNumber,
      unitCost: part.unitCost,
      totalCost:
        part.unitCost === null ? null : part.quantity * part.unitCost,
      unitPrice: part.unitPrice,
      totalPrice:
        part.unitPrice === null ? null : part.quantity * part.unitPrice,
      inventoryItemId: part.componentAccessoryId,
      note: part.note,
      usedAt: new Date(),
      createdById: actor.id,
    })),
  });

  await replaceWorkAccessoryStockExports({
    actor,
    customerId,
    machineId,
    owner,
    parts: normalized,
    prisma,
    tx,
  });
}

async function normalizeWorkUsedParts(
  prisma: PrismaService,
  parts: UsedPartDto[],
  machineId: string | null,
) {
  const cleanedParts = parts
    .map((part) => ({
      componentAccessoryId: part.componentAccessoryId?.trim() || null,
      name: part.name?.trim() || '',
      quantity: Number(part.quantity || 0),
      unit: part.unit?.trim() || null,
      serialNumber: part.serialNumber?.trim() || null,
      unitCost: part.unitCost === undefined || part.unitCost === null ? null : Number(part.unitCost),
      unitPrice: part.unitPrice === undefined || part.unitPrice === null ? null : Number(part.unitPrice),
      note: part.note?.trim() || null,
    }))
    .filter((part) => part.quantity > 0 && (part.componentAccessoryId || part.name));

  if (!cleanedParts.length) {
    return [];
  }

  if (!machineId && cleanedParts.some((part) => part.componentAccessoryId)) {
    throw new BadRequestException('Machine is required when using model accessories');
  }

  const machine = machineId
    ? await prisma.machine.findUnique({
        where: { id: machineId },
        select: { machineModelId: true },
      })
    : null;
  const accessoryIds = cleanedParts
    .map((part) => part.componentAccessoryId)
    .filter((id): id is string => Boolean(id));
  const accessories = accessoryIds.length
    ? await prisma.componentAccessory.findMany({
        where: {
          id: { in: accessoryIds },
          machineModelId: machine?.machineModelId || '__no_model__',
          status: 'ACTIVE',
        },
      })
    : [];
  const accessoryMap = new Map(accessories.map((accessory) => [accessory.id, accessory]));

  if (accessoryIds.some((id) => !accessoryMap.has(id))) {
    throw new BadRequestException('Selected accessory does not belong to this machine model');
  }

  return cleanedParts.map((part) => {
    const accessory = part.componentAccessoryId ? accessoryMap.get(part.componentAccessoryId) : null;
    const defaultUnitCost =
      accessory?.unitCost === undefined || accessory?.unitCost === null
        ? null
        : Number(accessory.unitCost);
    const defaultUnitPrice =
      accessory?.salePrice === undefined || accessory?.salePrice === null
        ? null
        : Number(accessory.salePrice);
    return {
      ...part,
      name: accessory?.name || part.name,
      unit: part.unit || 'cái',
      unitCost: part.unitCost ?? defaultUnitCost,
      unitPrice: part.unitPrice ?? defaultUnitPrice,
    };
  });
}
