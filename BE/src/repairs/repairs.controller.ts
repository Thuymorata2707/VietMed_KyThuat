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
import { RequestUser } from '../common/request-user.type';
import { AssignRepairDto } from './dto/assign-repair.dto';
import { CreateRepairDto } from './dto/create-repair.dto';
import { ListRepairsQueryDto } from './dto/list-repairs-query.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairDto } from './dto/update-repair.dto';
import { RepairsService } from './repairs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('repairs')
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  @Roles('admin', 'engineer')
  @Post()
  create(@Body() dto: CreateRepairDto, @CurrentUser() user: RequestUser) {
    return this.repairsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListRepairsQueryDto, @CurrentUser() user: RequestUser) {
    return this.repairsService.findAll(query, user);
  }

  @Get('statuses')
  getStatuses() {
    return this.repairsService.getStatuses();
  }

  @Get('priorities')
  getPriorities() {
    return this.repairsService.getPriorities();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.repairsService.findOne(id, user);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRepairDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.repairsService.update(id, dto, user);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignRepairDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.repairsService.assign(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRepairStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.repairsService.updateStatus(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.repairsService.remove(id, user);
  }
}
