import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MachineStatus } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { MachinesService } from './machines.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateMachineDto) {
    return this.machinesService.create(dto);
  }

  @Get()
  findAll() {
    return this.machinesService.findAll();
  }

  @Get('statuses')
  getStatuses() {
    return this.machinesService.getStatuses();
  }

  @Get('product-categories')
  getProductCategories() {
    return this.machinesService.getProductCategories();
  }

  @Get('inventory-statuses')
  getInventoryStatuses() {
    return this.machinesService.getInventoryStatuses();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.machinesService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMachineDto) {
    return this.machinesService.update(id, dto);
  }

  @Roles('admin')
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body('status') status: MachineStatus) {
    return this.machinesService.setStatus(id, status);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.machinesService.remove(id);
  }
}
