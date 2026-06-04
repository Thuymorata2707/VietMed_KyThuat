import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRegionDto) {
    if (!dto.name?.trim() || !dto.code?.trim()) {
      throw new BadRequestException('name and code are required');
    }

    const code = dto.code.toUpperCase().trim();
    const existingRegion = await this.prisma.region.findUnique({
      where: { code },
    });

    if (existingRegion) {
      throw new ConflictException('Region code already exists');
    }

    return this.prisma.region.create({
      data: {
        name: dto.name.trim(),
        code,
      },
    });
  }

  findAll() {
    return this.prisma.region.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }
}
