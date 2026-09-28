import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { InventoryMovementsService } from './inventory-movements.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory-movements')
export class InventoryMovementsController {
  constructor(
    private readonly inventoryMovementsService: InventoryMovementsService,
  ) {}

  @Roles('admin')
  @Post()
  create(
    @Body() dto: CreateInventoryMovementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryMovementsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: ListInventoryMovementsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryMovementsService.findAll(query, user);
  }

  @Get('types')
  getTypes() {
    return this.inventoryMovementsService.getTypes();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventoryMovementsService.findOne(id, user);
  }
}
