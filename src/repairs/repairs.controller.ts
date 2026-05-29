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
import { AssignRepairDto } from './dto/assign-repair.dto';
import { CreateRepairDto } from './dto/create-repair.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairDto } from './dto/update-repair.dto';
import { RepairsService } from './repairs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('repairs')
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateRepairDto) {
    return this.repairsService.create(dto);
  }

  @Get()
  findAll() {
    return this.repairsService.findAll();
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
  findOne(@Param('id') id: string) {
    return this.repairsService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRepairDto) {
    return this.repairsService.update(id, dto);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignRepairDto) {
    return this.repairsService.assign(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRepairStatusDto) {
    return this.repairsService.updateStatus(id, dto);
  }
}
