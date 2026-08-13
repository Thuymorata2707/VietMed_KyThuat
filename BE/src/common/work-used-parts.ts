import { BadRequestException } from '@nestjs/common';
import { Prisma, WorkTaskKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './request-user.type';
import { UsedPartDto } from './dto/used-part.dto';

type WorkOwner = {
  id: string;
  kind: WorkTaskKind;
  field: 'repairId' | 'maintenanceId';
};

export async function replaceWorkUsedParts({
  actor,
  machineId,
  owner,
  parts,
  prisma,
  tx,
}: {
  actor: RequestUser;
  machineId: string | null;
  owner: WorkOwner;
  parts: UsedPartDto[];
  prisma: PrismaService;
  tx: Prisma.TransactionClient;
}) {
  await tx.usedPart.deleteMany({ where: { [owner.field]: owner.id } });
  const normalized = await normalizeWorkUsedParts(prisma, parts, machineId);

  if (!normalized.length) {
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
      inventoryItemId: part.componentAccessoryId,
      note: part.note,
      usedAt: new Date(),
      createdById: actor.id,
    })),
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
    return {
      ...part,
      name: accessory?.name || part.name,
      unit: part.unit || 'cái',
    };
  });
}
