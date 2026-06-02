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
import { MachineStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { CreateMachineDto } from './dto/create-machine.dto';
import { ListMachinesQueryDto } from './dto/list-machines-query.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { MachinesService } from './machines.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateMachineDto, @CurrentUser() user: RequestUser) {
    return this.machinesService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListMachinesQueryDto, @CurrentUser() user: RequestUser) {
    return this.machinesService.findAll(query, user);
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

  @Get('serial/:serialNumber')
  findBySerialNumber(
    @Param('serialNumber') serialNumber: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.machinesService.findBySerialNumber(serialNumber, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.machinesService.findOne(id, user);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.machinesService.update(id, dto, user);
  }

  @Roles('admin')
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body('status') status: MachineStatus,
    @CurrentUser() user: RequestUser,
  ) {
    return this.machinesService.setStatus(id, status, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.machinesService.remove(id, user);
  }
}
