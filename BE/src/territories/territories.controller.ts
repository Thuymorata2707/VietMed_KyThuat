import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TerritoriesService } from './territories.service';

class AssignProvinceDto {
  @IsOptional()
  @IsString()
  branchId?: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'engineer')
@Controller()
export class TerritoriesController {
  constructor(private readonly territoriesService: TerritoriesService) {}

  @Get('branches')
  findBranches() {
    return this.territoriesService.findBranches();
  }

  @Get('provinces')
  findProvinces(@Query('branchId') branchId?: string, @Query('unassigned') unassigned?: string) {
    return this.territoriesService.findProvinces(branchId, unassigned === 'true');
  }

  @Roles('admin')
  @Patch('provinces/:provinceId/branch')
  assignProvince(@Param('provinceId') provinceId: string, @Body() dto: AssignProvinceDto) {
    return this.territoriesService.assignProvince(provinceId, dto.branchId ?? null);
  }
}
