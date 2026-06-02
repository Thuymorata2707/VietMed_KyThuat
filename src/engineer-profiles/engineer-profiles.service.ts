import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEngineerProfileDto } from './dto/upsert-engineer-profile.dto';

@Injectable()
export class EngineerProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const profiles = await this.prisma.engineerProfile.findMany({
      include: this.defaultInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return profiles.map((profile) => this.withComputedFields(profile));
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.engineerProfile.findUnique({
      where: { userId },
      include: this.defaultInclude(),
    });

    if (!profile) {
      throw new NotFoundException('Engineer profile not found');
    }

    return this.withComputedFields(profile);
  }

  async upsert(userId: string, dto: UpsertEngineerProfileDto) {
    await this.ensureEngineerUser(userId);

    if (dto.employeeCode) {
      await this.ensureEmployeeCodeIsAvailable(dto.employeeCode, userId);
    }

    const profile = await this.prisma.engineerProfile.upsert({
      where: { userId },
      create: {
        userId,
        employeeCode: dto.employeeCode?.trim() || null,
        dateOfBirth: this.parseOptionalDate(dto.dateOfBirth, 'dateOfBirth'),
        position: dto.position?.trim() || null,
        department: dto.department?.trim() || null,
        workStartDate: this.parseOptionalDate(
          dto.workStartDate,
          'workStartDate',
        ),
        specialties: this.normalizeSpecialties(dto.specialties),
        certificateNo: dto.certificateNo?.trim() || null,
        photoUrl: dto.photoUrl?.trim() || null,
        note: dto.note?.trim() || null,
      },
      update: {
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
        certificateNo:
          dto.certificateNo === undefined
            ? undefined
            : dto.certificateNo?.trim() || null,
        photoUrl:
          dto.photoUrl === undefined ? undefined : dto.photoUrl?.trim() || null,
        note: dto.note === undefined ? undefined : dto.note?.trim() || null,
      },
      include: this.defaultInclude(),
    });

    return this.withComputedFields(profile);
  }

  private async ensureEngineerUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role.name !== 'engineer' && user.role.name !== 'admin') {
      throw new BadRequestException('User is not an engineer');
    }
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

  private calculateYearsOfExperience(
    workStartDate: Date | null,
  ): number | null {
    if (!workStartDate) {
      return null;
    }

    const now = new Date();
    let years = now.getFullYear() - workStartDate.getFullYear();
    const monthDiff = now.getMonth() - workStartDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < workStartDate.getDate())
    ) {
      years -= 1;
    }

    return Math.max(years, 0);
  }

  private withComputedFields<T extends { workStartDate: Date | null }>(
    profile: T,
  ) {
    return {
      ...profile,
      yearsOfExperience: this.calculateYearsOfExperience(profile.workStartDate),
    };
  }

  private defaultInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
        },
      },
    };
  }
}
