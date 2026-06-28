import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { RequestUser } from '../common/request-user.type';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: RequestUser) {
    assertPermission(user, PERMISSIONS.DASHBOARD_READ);
    return this.dashboardService.getSummary(user);
  }

  @Get('technical-machines')
  getTechnicalMachines(
    @CurrentUser() user: RequestUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.DASHBOARD_READ);
    return this.dashboardService.getTechnicalMachines(user, query);
  }

  @Get('technical-statistics')
  getTechnicalStatistics(
    @CurrentUser() user: RequestUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.DASHBOARD_READ);
    return this.dashboardService.getTechnicalStatistics(user, query);
  }
}
