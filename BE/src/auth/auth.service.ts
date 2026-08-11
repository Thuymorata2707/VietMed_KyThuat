import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto, UpdateMyEngineerProfileDto } from './dto/update-me.dto';
import { JwtService } from './jwt.service';
import { LoginThrottleService } from './login-throttle.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const identifier = this.normalizeLoginIdentifier(
      dto.identifier || dto.email,
    );
    this.loginThrottle.assertCanAttempt(identifier, ip);

    if (!identifier || !dto.password) {
      this.loginThrottle.recordFailure(identifier, ip);
      throw new UnauthorizedException('Login name and password are required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      this.loginThrottle.recordFailure(identifier, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      this.loginThrottle.recordFailure(identifier, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginThrottle.recordSuccess(identifier, ip);

    const requestUser = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      regionId: user.regionId,
    };

    return {
      accessToken: this.jwtService.sign(requestUser),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
        role: user.role,
        region: user.region,
        engineerProfile: user.engineerProfile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async getMe(user: RequestUser) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
    });

    if (!currentUser || currentUser.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.withoutPassword(currentUser);
  }

  async updateMe(user: RequestUser, dto: UpdateMeDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: true,
        region: true,
        engineerProfile: true,
      },
    });

    if (!currentUser || currentUser.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: this.normalizeEmail(dto.email) },
      });

      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.username !== undefined) {
      await this.ensureUsernameIsAvailable(dto.username, user.id);
    }

    if (dto.engineerProfile?.employeeCode) {
      await this.ensureEmployeeCodeIsAvailable(
        dto.engineerProfile.employeeCode,
        user.id,
      );
    }

    if (
      dto.engineerProfile &&
      currentUser.role.name !== 'engineer' &&
      currentUser.role.name !== 'admin'
    ) {
      throw new BadRequestException('User is not an engineer');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
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
        },
      });

      if (dto.engineerProfile) {
        await tx.engineerProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            ...this.buildEngineerProfileData(dto.engineerProfile),
          },
          update: this.buildEngineerProfileData(dto.engineerProfile),
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          role: true,
          region: true,
          engineerProfile: true,
        },
      });
    });

    return this.withoutPassword(updatedUser);
  }

  private buildEngineerProfileData(dto: UpdateMyEngineerProfileDto) {
    return {
      employeeCode:
        dto.employeeCode === undefined
          ? undefined
          : dto.employeeCode?.trim() || null,
      dateOfBirth:
        dto.dateOfBirth === undefined
          ? undefined
          : this.parseOptionalDate(dto.dateOfBirth, 'dateOfBirth'),
      position:
        dto.position === undefined ? undefined : dto.position?.trim() || null,
      department:
        dto.department === undefined
          ? undefined
          : dto.department?.trim() || null,
      workStartDate:
        dto.workStartDate === undefined
          ? undefined
          : this.parseOptionalDate(dto.workStartDate, 'workStartDate'),
      specialties:
        dto.specialties === undefined
          ? undefined
          : this.normalizeSpecialties(dto.specialties),
      expertiseGroup:
        dto.expertiseGroup === undefined ? undefined : dto.expertiseGroup,
      certificateNo:
        dto.certificateNo === undefined
          ? undefined
          : dto.certificateNo?.trim() || null,
      photoUrl:
        dto.photoUrl === undefined ? undefined : dto.photoUrl?.trim() || null,
      note: dto.note === undefined ? undefined : dto.note?.trim() || null,
    };
  }

  private async ensureEmployeeCodeIsAvailable(
    employeeCode: string,
    userId: string,
  ) {
    const existingProfile = await this.prisma.engineerProfile.findUnique({
      where: {
        employeeCode: employeeCode.trim(),
      },
    });

    if (existingProfile && existingProfile.userId !== userId) {
      throw new ConflictException('Employee code already exists');
    }
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private normalizeSpecialties(specialties?: string[]): string[] {
    if (!specialties?.length) {
      return [];
    }

    return specialties
      .map((specialty) => specialty.trim())
      .filter((specialty) => specialty.length > 0);
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private normalizeLoginIdentifier(value?: string): string {
    return value?.toLowerCase().trim() || '';
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

  private withoutPassword<
    T extends User & {
      role: {
        id: string;
        name: string;
      };
      region: {
        id: string;
        name: string;
        code: string;
      };
      engineerProfile: unknown;
    },
  >(user: T) {
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
      engineerProfile: user.engineerProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
