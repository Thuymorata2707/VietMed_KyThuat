import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { AccessoryInventoryService } from './accessory-inventory.service';
import { CreateAccessoryStockMovementDto } from './dto/create-accessory-stock-movement.dto';
import { ListAccessoryInventoryQueryDto } from './dto/list-accessory-inventory-query.dto';
import { ListAccessoryStockMovementsQueryDto } from './dto/list-accessory-stock-movements-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accessory-inventory')
export class AccessoryInventoryController {
  constructor(private readonly service: AccessoryInventoryService) {}

  @Get()
  findStock(
    @Query() query: ListAccessoryInventoryQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findStock(query, user);
  }

  @Get('movements')
  findMovements(
    @Query() query: ListAccessoryStockMovementsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findMovements(query, user);
  }

  @Get('movement-types')
  getMovementTypes() {
    return this.service.getMovementTypes();
  }

  @Roles('admin', 'engineer')
  @Post('movements')
  createMovement(
    @Body() dto: CreateAccessoryStockMovementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createMovement(dto, user);
  }
}
