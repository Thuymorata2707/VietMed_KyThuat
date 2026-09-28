import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TerritoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findBranches() {
    return this.prisma.branch.findMany({
      include: { _count: { select: { provinces: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findProvinces(branchId?: string, unassigned?: boolean) {
    return this.prisma.province.findMany({
      where: {
        ...(unassigned ? { branchId: null } : branchId ? { branchId } : {}),
      },
      include: { branch: true },
      orderBy: { name: 'asc' },
    });
  }

  async assignProvince(provinceId: string, branchId: string | null) {
    const province = await this.prisma.province.findUnique({ where: { id: provinceId } });
    if (!province) throw new NotFoundException('Province not found');
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
    }
    return this.prisma.province.update({
      where: { id: provinceId },
      data: { branchId },
      include: { branch: true },
    });
  }
}
