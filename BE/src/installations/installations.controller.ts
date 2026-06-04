import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { ListInstallationsQueryDto } from './dto/list-installations-query.dto';
import { InstallationsService } from './installations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('installations')
export class InstallationsController {
  constructor(private readonly installationsService: InstallationsService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateInstallationDto, @CurrentUser() user: RequestUser) {
    return this.installationsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: ListInstallationsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.installationsService.findAll(query, user);
  }

  @Get('statuses')
  getStatuses() {
    return this.installationsService.getStatuses();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.installationsService.findOne(id, user);
  }
}
