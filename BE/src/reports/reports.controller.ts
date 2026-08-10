import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { RequestUser } from '../common/request-user.type';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('technical')
  getTechnicalReport(
    @CurrentUser() user: RequestUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.INSTALLATION_READ);
    assertPermission(user, PERMISSIONS.REPAIR_READ);
    assertPermission(user, PERMISSIONS.MAINTENANCE_READ);
    assertPermission(user, PERMISSIONS.DEMO_LOAN_READ);
    return this.reportsService.getTechnicalReport(user, query);
  }

  @Get('installations')
  getInstallationReport(
    @CurrentUser() user: RequestUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.INSTALLATION_READ);
    return this.reportsService.getInstallationReport(user, query);
  }

  @Get('engineers/:engineerId')
  getEngineerReport(
    @CurrentUser() user: RequestUser,
    @Param('engineerId') engineerId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.INSTALLATION_READ);
    assertPermission(user, PERMISSIONS.REPAIR_READ);
    assertPermission(user, PERMISSIONS.MAINTENANCE_READ);
    return this.reportsService.getEngineerReport(user, engineerId, query);
  }

  @Get('models/:modelKey')
  getModelReport(
    @CurrentUser() user: RequestUser,
    @Param('modelKey') modelKey: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    assertPermission(user, PERMISSIONS.INSTALLATION_READ);
    assertPermission(user, PERMISSIONS.REPAIR_READ);
    assertPermission(user, PERMISSIONS.MAINTENANCE_READ);
    return this.reportsService.getModelReport(user, modelKey, query);
  }
}
