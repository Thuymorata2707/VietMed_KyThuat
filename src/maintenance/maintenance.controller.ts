import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignMaintenanceDto } from './dto/assign-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(dto);
  }

  @Get()
  findAll() {
    return this.maintenanceService.findAll();
  }

  @Get('statuses')
  getStatuses() {
    return this.maintenanceService.getStatuses();
  }

  @Get('types')
  getTypes() {
    return this.maintenanceService.getTypes();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenanceService.update(id, dto);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignMaintenanceDto) {
    return this.maintenanceService.assign(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
  ) {
    return this.maintenanceService.updateStatus(id, dto);
  }
}
