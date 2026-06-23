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
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import { RequestUser } from '../common/request-user.type';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { ListInstallationsQueryDto } from './dto/list-installations-query.dto';
import { UpdateInstallationDto } from './dto/update-installation.dto';
import { UpdateInstallationStatusDto } from './dto/update-installation-status.dto';
import { InstallationsService } from './installations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('installations')
export class InstallationsController {
  constructor(private readonly installationsService: InstallationsService) {}

  @Roles('admin', 'engineer')
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

  @Roles('admin', 'engineer')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstallationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.installationsService.update(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInstallationStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.installationsService.updateStatus(id, dto, user);
  }

  @Roles('admin')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewWorkTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.installationsService.review(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.installationsService.remove(id, user);
  }
}
