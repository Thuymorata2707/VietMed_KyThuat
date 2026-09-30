import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EngineerProfile, Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { pickChangedFields } from '../common/audit-changes';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { isAdmin, userAccessWhere } from '../auth/access-scope';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type UserWithoutPassword = Omit<User, 'password'> & {
  role: {
    id: string;
    name: string;
  };
  region: {
    id: string;
    name: string;
    code: string;
  };
  engineerProfile: (EngineerProfile & { expertiseGroups?: Array<'IMAGING' | 'LAB_TESTING'> }) | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor?: RequestUser,
  ): Promise<UserWithoutPassword> {
    this.validateCreateUser(dto);
    this.assertCanManageRegion(dto.regionId, actor);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    await this.ensureUsernameIsAvailable(dto.username);
    await this.ensureRoleAndRegionExist(dto.roleId, dto.regionId);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: this.normalizeEmail(dto.email),
          username: this.normalizeOptionalUsername(dto.username),
          password: await bcrypt.hash(dto.password, 10),
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          roleId: dto.roleId,
          regionId: dto.regionId,
          status: dto.status ?? UserStatus.ACTIVE,
        },
        include: {
          role: true,
          region: true,
          engineerProfile: true,
        },
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'User',
          entityId: created.id,
          actor,
          metadata: {
            email: created.email,
            username: created.username,
            roleId: created.roleId,
            regionId: created.regionId,
            status: created.status,
          },
        },
        tx,
      );

      return created;
    });

    return this.withoutPassword(user);
  }

  async findAll(
    query?: ListUsersQueryDto,
    actor?: RequestUser,
  ): Promise<UserWithoutPassword[] | PaginatedResult<UserWithoutPassword>> {
    if (!this.shouldPaginate(query)) {
      return this.findAllLegacy(actor);
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const where = this.buildFindAllWhere(query, actor);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          role: true,
          region: true,
          engineerProfile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.withoutPassword(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async findAllLegacy(
    actor?: RequestUser,
  ): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany({
      where: userAccessWhere(actor),
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.withoutPassword(user));
  }

  async findOne(id: string, actor?: RequestUser): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        AND: [userAccessWhere(actor)],
      },
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.withoutPassword(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor?: RequestUser,
  ): Promise<UserWithoutPassword> {
    const current = await this.findOne(id, actor);
    this.assertCanManageRegion(dto.regionId, actor);

    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: this.normalizeEmail(dto.email) },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.username !== undefined) {
      await this.ensureUsernameIsAvailable(dto.username, id);
    }

    if (dto.roleId || dto.regionId) {
      const currentUser = await this.prisma.user.findUniqueOrThrow({
        where: { id },
      });

      await this.ensureRoleAndRegionExist(
        dto.roleId ?? currentUser.roleId,
        dto.regionId ?? currentUser.regionId,
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          username:
            dto.username === undefined
              ? undefined
              : this.normalizeOptionalUsername(dto.username),
          password: dto.password
            ? await bcrypt.hash(dto.password, 10)
            : undefined,
          fullName: dto.fullName?.trim(),
          phone:
            dto.phone === undefined ? undefined : dto.phone?.trim() || null,
          roleId: dto.roleId,
          regionId: dto.regionId,
          status: dto.status,
        },
        include: {
          role: true,
          region: true,
          engineerProfile: true,
        },
      });

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'User',
          entityId: id,
          actor,
          changes: pickChangedFields(current, this.withoutPassword(updated), [
            'email',
            'username',
            'fullName',
            'phone',
            'roleId',
            'regionId',
            'status',
          ]),
          metadata: {
            passwordChanged: Boolean(dto.password),
          },
        },
        tx,
      );

      return updated;
    });

    return this.withoutPassword(user);
  }

  async setStatus(
    id: string,
    status: UserStatus,
    actor?: RequestUser,
  ): Promise<UserWithoutPassword> {
    const current = await this.findOne(id, actor);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status },
        include: {
          role: true,
          region: true,
          engineerProfile: true,
        },
      });

      await this.auditLogsService.create(
        {
          action: 'STATUS_CHANGE',
          entityType: 'User',
          entityId: id,
          actor,
          changes: {
            status: {
              from: current.status,
              to: updated.status,
            },
          },
        },
        tx,
      );

      return updated;
    });

    return this.withoutPassword(user);
  }

  async remove(id: string, actor?: RequestUser) {
    if (actor?.id === id) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.findOne(id, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.repair.updateMany({
        where: { engineerId: id },
        data: { engineerId: null },
      });

      await tx.maintenance.updateMany({
        where: { engineerId: id },
        data: { engineerId: null },
      });

      await tx.machine.updateMany({
        where: { installedById: id },
        data: { installedById: null },
      });

      await tx.machine.updateMany({
        where: { primaryEngineerId: id },
        data: { primaryEngineerId: null },
      });

      await tx.businessLine.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });

      await tx.engineerProfile.deleteMany({
        where: { userId: id },
      });

      await tx.user.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: 'DELETE',
          entityType: 'User',
          entityId: id,
          actor,
          metadata: {
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            roleId: user.roleId,
            regionId: user.regionId,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  private validateCreateUser(dto: CreateUserDto) {
    if (
      !dto.email ||
      !dto.password ||
      !dto.fullName ||
      !dto.roleId ||
      !dto.regionId
    ) {
      throw new BadRequestException(
        'email, password, fullName, roleId and regionId are required',
      );
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
  }

  private async ensureRoleAndRegionExist(roleId: string, regionId: string) {
    const [role, region] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.region.findUnique({ where: { id: regionId } }),
    ]);

    if (!role) {
      throw new BadRequestException('Role does not exist');
    }

    if (!region) {
      throw new BadRequestException('Region does not exist');
    }
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private normalizeOptionalUsername(username?: string | null): string | null {
    const normalized = username?.toLowerCase().trim();
    return normalized || null;
  }

  private async ensureUsernameIsAvailable(
    username?: string | null,
    userId?: string,
  ) {
    const normalized = this.normalizeOptionalUsername(username);
    if (!normalized) return;

    const existingUser = await this.prisma.user.findUnique({
      where: { username: normalized },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username already exists');
    }
  }

  private shouldPaginate(query?: ListUsersQueryDto): boolean {
    return Boolean(
      query?.search ||
      query?.limit ||
      query?.page ||
      query?.roleName ||
      query?.regionId ||
      query?.status,
    );
  }

  private buildFindAllWhere(
    query?: ListUsersQueryDto,
    actor?: RequestUser,
  ): Prisma.UserWhereInput {
    const search = query?.search?.trim();
    const roleName = query?.roleName?.trim();
    const conditions: Prisma.UserWhereInput[] = [];

    if (roleName) {
      conditions.push(
        this.isEngineerRoleName(roleName)
          ? {
              OR: [
                {
                  role: {
                    name: {
                      equals: roleName,
                    },
                  },
                },
                {
                  engineerProfile: {
                    isNot: null,
                  },
                },
              ],
            }
          : {
              role: {
                name: {
                  equals: roleName,
                },
              },
            },
      );
    }

    if (search) {
      conditions.push({
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
          { fullName: { contains: search } },
          { phone: { contains: search } },
          {
            region: {
              name: { contains: search },
            },
          },
          {
            engineerProfile: {
              employeeCode: { contains: search },
            },
          },
        ],
      });
    }

    const requestedRegionId = this.canUseRequestedRegion(query?.regionId, actor)
      ? query?.regionId
      : undefined;

    return {
      status: query?.status,
      regionId: requestedRegionId,
      AND: [userAccessWhere(actor), ...conditions].filter(
        (item) => Object.keys(item).length,
      ),
    };
  }

  private canUseRequestedRegion(
    regionId: string | undefined,
    actor?: RequestUser,
  ) {
    if (!regionId) return false;
    if (isAdmin(actor)) return regionId === actor.regionId;
    return false;
  }

  private assertCanManageRegion(
    regionId: string | undefined,
    actor?: RequestUser,
  ) {
    if (!actor || !isAdmin(actor) || !regionId) return;
    if (regionId !== actor.regionId) {
      throw new ForbiddenException(
        'Chỉ được phép quản lý nhân sự trong khu vực được phân quyền.',
      );
    }
  }

  private isEngineerRoleName(roleName: string) {
    const normalized = roleName.toLowerCase().trim();
    return (
      normalized === 'engineer' ||
      normalized === 'kỹ sư' ||
      normalized === 'ky su'
    );
  }

  private withoutPassword<
    T extends User & {
      role: UserWithoutPassword['role'];
      region: UserWithoutPassword['region'];
      engineerProfile: EngineerProfile | null;
    },
  >(user: T): UserWithoutPassword {
    const profile = user.engineerProfile;
    const groups = profile
      ? [profile.expertiseImaging ? 'IMAGING' : null, profile.expertiseLabTesting ? 'LAB_TESTING' : null]
          .filter((group): group is 'IMAGING' | 'LAB_TESTING' => Boolean(group))
      : [];
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      roleId: user.roleId,
      role: user.role,
      regionId: user.regionId,
      region: user.region,
      engineerProfile: profile
        ? {
            ...profile,
            expertiseGroups: groups.length
              ? groups
              : profile.expertiseGroup === 'IMAGING' || profile.expertiseGroup === 'LAB_TESTING'
                ? [profile.expertiseGroup]
                : [],
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
