import {
  Body,
  Controller,
  Delete,
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
import { DeleteWorkTaskDto } from '../common/dto/delete-work-task.dto';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
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

  @Roles('admin')
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

  @Get('next-code')
  async nextCode(@Query('date') date?: string) {
    return { code: await this.maintenanceService.previewCode(date) };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.maintenanceService.findOne(id, user);
  }

  @Roles('admin', 'engineer')
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

  @Roles('admin')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewWorkTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.review(id, dto, user);
  }

  @Roles('admin', 'engineer')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() dto: DeleteWorkTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.maintenanceService.remove(id, user, dto);
  }
}
