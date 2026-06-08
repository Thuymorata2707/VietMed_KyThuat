import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { AssignMaintenanceDto } from './dto/assign-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Roles('admin', 'engineer')
  @Post()
  create(@Body() dto: CreateMaintenanceDto, @CurrentUser() user: RequestUser) {
    return this.maintenanceService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: ListMaintenanceQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.findAll(query, user);
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
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.maintenanceService.findOne(id, user);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.update(id, dto, user);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignMaintenanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.assign(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.updateStatus(id, dto, user);
  }
}
