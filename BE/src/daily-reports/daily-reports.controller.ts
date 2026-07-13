import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { DailyReportsService } from './daily-reports.service';
import { ReviewDailyReportDto } from './dto/review-daily-report.dto';
import { SaveDailyReportDto } from './dto/save-daily-report.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('daily-reports')
export class DailyReportsController {
  constructor(private readonly service: DailyReportsService) {}

  @Get()
  findByDate(
    @CurrentUser() user: RequestUser,
    @Query('date') reportDate?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.findByDate({ user, reportDate, userId });
  }

  @Post()
  save(@Body() dto: SaveDailyReportDto, @CurrentUser() user: RequestUser) {
    return this.service.save(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SaveDailyReportDto, @CurrentUser() user: RequestUser) {
    return this.service.save(dto, user);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewDailyReportDto, @CurrentUser() user: RequestUser) {
    return this.service.review(id, dto, user);
  }
}
