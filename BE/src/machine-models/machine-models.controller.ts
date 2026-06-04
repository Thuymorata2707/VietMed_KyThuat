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
import { CreateMachineModelDto } from './dto/create-machine-model.dto';
import { ListMachineModelsQueryDto } from './dto/list-machine-models-query.dto';
import { UpdateMachineModelDto } from './dto/update-machine-model.dto';
import { MachineModelsService } from './machine-models.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machine-models')
export class MachineModelsController {
  constructor(private readonly machineModelsService: MachineModelsService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateMachineModelDto, @CurrentUser() user: RequestUser) {
    return this.machineModelsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListMachineModelsQueryDto) {
    return this.machineModelsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.machineModelsService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMachineModelDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.machineModelsService.update(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.machineModelsService.remove(id, user);
  }
}
