import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('weekly-reports')
export class WeeklyReportsController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Get('summary')
  getEngineerSummary(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.weeklyReportsService.getEngineerSummary({ user, from, to, userId });
  }

  @Get('daily-work-rows')
  getDailyWorkRows(
    @CurrentUser() user: RequestUser,
    @Query('weekStart') weekStart?: string,
    @Query('userId') userId?: string,
  ) {
    return this.weeklyReportsService.getDailyWorkRows({ user, weekStart, userId });
  }

  @Get()
  findByWeek(
    @CurrentUser() user: RequestUser,
    @Query('weekStart') weekStart?: string,
    @Query('userId') userId?: string,
  ) {
    return this.weeklyReportsService.findByWeek({ user, weekStart, userId });
  }

  @Post()
  save(@Body() dto: SaveWeeklyReportDto, @CurrentUser() user: RequestUser) {
    return this.weeklyReportsService.save(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveWeeklyReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.weeklyReportsService.update(id, dto, user);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.weeklyReportsService.submit(id, user);
  }
}
