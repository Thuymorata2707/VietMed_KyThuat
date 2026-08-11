import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRegionDto } from './dto/create-region.dto';
import { RegionsService } from './regions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'engineer')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateRegionDto) {
    return this.regionsService.create(dto);
  }

  @Get()
  findAll() {
    return this.regionsService.findAll();
  }
}
