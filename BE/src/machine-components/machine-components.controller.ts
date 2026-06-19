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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateComponentAccessoryDto } from './dto/create-component-accessory.dto';
import { CreateMachineComponentDto } from './dto/create-machine-component.dto';
import { ListComponentAccessoriesQueryDto } from './dto/list-component-accessories-query.dto';
import { ListMachineComponentsQueryDto } from './dto/list-machine-components-query.dto';
import { UpdateComponentAccessoryDto } from './dto/update-component-accessory.dto';
import { UpdateMachineComponentDto } from './dto/update-machine-component.dto';
import { MachineComponentsService } from './machine-components.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MachineComponentsController {
  constructor(private readonly service: MachineComponentsService) {}

  @Roles('admin')
  @Post('machine-components')
  createComponent(@Body() dto: CreateMachineComponentDto) {
    return this.service.createComponent(dto);
  }

  @Get('machine-components')
  findComponents(@Query() query: ListMachineComponentsQueryDto) {
    return this.service.findComponents(query);
  }

  @Get('machine-components/:id')
  findComponent(@Param('id') id: string) {
    return this.service.findComponent(id);
  }

  @Roles('admin')
  @Patch('machine-components/:id')
  updateComponent(
    @Param('id') id: string,
    @Body() dto: UpdateMachineComponentDto,
  ) {
    return this.service.updateComponent(id, dto);
  }

  @Roles('admin')
  @Delete('machine-components/:id')
  removeComponent(@Param('id') id: string) {
    return this.service.removeComponent(id);
  }

  @Roles('admin')
  @Post('component-accessories')
  createAccessory(@Body() dto: CreateComponentAccessoryDto) {
    return this.service.createAccessory(dto);
  }

  @Get('component-accessories')
  findAccessories(@Query() query: ListComponentAccessoriesQueryDto) {
    return this.service.findAccessories(query);
  }

  @Get('component-accessories/:id')
  findAccessory(@Param('id') id: string) {
    return this.service.findAccessory(id);
  }

  @Roles('admin')
  @Patch('component-accessories/:id')
  updateAccessory(
    @Param('id') id: string,
    @Body() dto: UpdateComponentAccessoryDto,
  ) {
    return this.service.updateAccessory(id, dto);
  }

  @Roles('admin')
  @Delete('component-accessories/:id')
  removeAccessory(@Param('id') id: string) {
    return this.service.removeAccessory(id);
  }
}
