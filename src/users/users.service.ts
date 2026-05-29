import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EngineerProfile, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
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
  engineerProfile: EngineerProfile | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserWithoutPassword> {
    this.validateCreateUser(dto);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    await this.ensureRoleAndRegionExist(dto.roleId, dto.regionId);

    const user = await this.prisma.user.create({
      data: {
        email: this.normalizeEmail(dto.email),
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

    return this.withoutPassword(user);
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany({
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

  async findOne(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async update(id: string, dto: UpdateUserDto): Promise<UserWithoutPassword> {
    await this.findOne(id);

    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: this.normalizeEmail(dto.email) },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
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

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ? this.normalizeEmail(dto.email) : undefined,
        password: dto.password
          ? await bcrypt.hash(dto.password, 10)
          : undefined,
        fullName: dto.fullName?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
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

    return this.withoutPassword(user);
  }

  async setStatus(
    id: string,
    status: UserStatus,
  ): Promise<UserWithoutPassword> {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
    });

    return this.withoutPassword(user);
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

  private withoutPassword<
    T extends User & {
      role: UserWithoutPassword['role'];
      region: UserWithoutPassword['region'];
      engineerProfile: EngineerProfile | null;
    },
  >(user: T): UserWithoutPassword {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      roleId: user.roleId,
      role: user.role,
      regionId: user.regionId,
      region: user.region,
      engineerProfile: user.engineerProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
