import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { normalizeRoleName } from './permissions';

export function isAdmin(user?: RequestUser): boolean {
  return normalizeRoleName(user?.roleName) === 'admin';
}

export function isManager(user?: RequestUser): boolean {
  return normalizeRoleName(user?.roleName) === 'manager';
}

export function isEngineer(user?: RequestUser): boolean {
  return normalizeRoleName(user?.roleName) === 'engineer';
}

export function machineAccessWhere(user?: RequestUser): Prisma.MachineWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { customer: { regionId: user.regionId } },
        { customerId: null },
        { installedBy: { regionId: user.regionId } },
        { primaryEngineer: { regionId: user.regionId } },
        { repairs: { some: { engineer: { regionId: user.regionId } } } },
        { maintenances: { some: { engineer: { regionId: user.regionId } } } },
        { installations: { some: { installedBy: { regionId: user.regionId } } } },
        { demoLoans: { some: { engineer: { regionId: user.regionId } } } },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { installedById: user.id },
        { primaryEngineerId: user.id },
        { customer: { primaryEngineerId: user.id } },
        { repairs: { some: { engineerId: user.id } } },
        { maintenances: { some: { engineerId: user.id } } },
        { installations: { some: { installedById: user.id } } },
        { demoLoans: { some: { engineerId: user.id } } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function customerAccessWhere(
  user?: RequestUser,
): Prisma.CustomerWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return { regionId: user.regionId };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { primaryEngineerId: user.id },
        { demoLoans: { some: { engineerId: user.id } } },
        {
          machines: {
            some: machineAccessWhere(user),
          },
        },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function repairAccessWhere(user?: RequestUser): Prisma.RepairWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { engineer: { regionId: user.regionId } },
        { createdBy: { regionId: user.regionId } },
        {
          customer: {
            regionId: user.regionId,
          },
        },
        {
          machine: {
            customer: {
              regionId: user.regionId,
            },
          },
        },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { engineerId: user.id },
        { customer: { primaryEngineerId: user.id } },
        { machine: { customer: { primaryEngineerId: user.id } } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function maintenanceAccessWhere(
  user?: RequestUser,
): Prisma.MaintenanceWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { engineer: { regionId: user.regionId } },
        {
          customer: {
            regionId: user.regionId,
          },
        },
        {
          machine: {
            customer: {
              regionId: user.regionId,
            },
          },
        },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { engineerId: user.id },
        { customer: { primaryEngineerId: user.id } },
        { machine: { customer: { primaryEngineerId: user.id } } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function installationAccessWhere(
  user?: RequestUser,
): Prisma.MachineInstallationWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { customer: { regionId: user.regionId } },
        { installedBy: { regionId: user.regionId } },
        { machine: { customer: { regionId: user.regionId } } },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { installedById: user.id },
        { customer: { primaryEngineerId: user.id } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function demoLoanAccessWhere(
  user?: RequestUser,
): Prisma.DemoLoanWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { customer: { regionId: user.regionId } },
        { engineer: { regionId: user.regionId } },
        { machine: { customer: { regionId: user.regionId } } },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { engineerId: user.id },
        { customer: { primaryEngineerId: user.id } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function inventoryMovementAccessWhere(
  user?: RequestUser,
): Prisma.MachineInventoryMovementWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return {
      OR: [
        { createdBy: { regionId: user.regionId } },
        { customer: { regionId: user.regionId } },
        { machine: { customer: { regionId: user.regionId } } },
      ],
    };
  }

  if (isEngineer(user)) {
    return {
      OR: [
        { createdById: user.id },
        { machine: machineAccessWhere(user) },
      ],
    };
  }

  return { id: '__no_access__' };
}

export function userAccessWhere(user?: RequestUser): Prisma.UserWhereInput {
  if (!user) {
    return {};
  }

  if (isAdmin(user) || isManager(user)) {
    return { regionId: user.regionId };
  }

  if (isEngineer(user)) {
    return { id: user.id };
  }

  return { id: '__no_access__' };
}
