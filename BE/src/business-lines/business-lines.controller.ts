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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { BusinessLinesService } from './business-lines.service';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-lines')
export class BusinessLinesController {
  constructor(private readonly businessLinesService: BusinessLinesService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateBusinessLineDto, @CurrentUser() user: RequestUser) {
    return this.businessLinesService.create(dto, user);
  }

  @Get()
  findAll() {
    return this.businessLinesService.findAll();
  }

  @Get('statuses')
  getStatuses() {
    return this.businessLinesService.getStatuses();
  }

  @Get(':id/models')
  findModels(@Param('id') id: string) {
    return this.businessLinesService.findModels(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessLinesService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.businessLinesService.update(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.businessLinesService.remove(id, user);
  }
}
