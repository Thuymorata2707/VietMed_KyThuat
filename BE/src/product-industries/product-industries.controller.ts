import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateProductIndustryDto } from './dto/create-product-industry.dto';
import { UpdateProductIndustryDto } from './dto/update-product-industry.dto';
import { ProductIndustriesService } from './product-industries.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-industries')
export class ProductIndustriesController {
  constructor(private readonly service: ProductIndustriesService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateProductIndustryDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductIndustryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
