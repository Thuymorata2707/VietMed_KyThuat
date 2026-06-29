import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { RequestUser } from '../common/request-user.type';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('installations')
  getInstallationReport(
    @CurrentUser() user: RequestUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.INSTALLATION_READ);
    return this.reportsService.getInstallationReport(user, query);
  }
}
