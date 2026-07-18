import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { ApplicationSupportService } from './application-support.service';
import { ApplicationSupportQueryDto } from './dto/application-support-query.dto';
import { SaveApplicationSupportCaseDto } from './dto/save-application-support-case.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('application-support')
export class ApplicationSupportController {
  constructor(private readonly service: ApplicationSupportService) {}

  @Get()
  findMany(@Query() query: ApplicationSupportQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.findMany(query, user);
  }

  @Get('weekly-report-rows')
  getWeeklyRows(
    @CurrentUser() user: RequestUser,
    @Query('weekStart') weekStart?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.getWeeklyRows({ user, weekStart, userId });
  }

  @Post()
  create(@Body() dto: SaveApplicationSupportCaseDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SaveApplicationSupportCaseDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
