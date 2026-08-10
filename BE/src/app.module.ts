import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationSupportModule } from './application-support/application-support.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { BusinessLinesModule } from './business-lines/business-lines.module';
import { CustomersModule } from './customers/customers.module';
import { AppConfigModule } from './config/app-config.module';
import { DailyWorkNotesModule } from './daily-work-notes/daily-work-notes.module';
import { DailyReportsModule } from './daily-reports/daily-reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DemoLoansModule } from './demo-loans/demo-loans.module';
import { EngineerProfilesModule } from './engineer-profiles/engineer-profiles.module';
import { InventoryMovementsModule } from './inventory-movements/inventory-movements.module';
import { InstallationsModule } from './installations/installations.module';
import { KnowledgeArticlesModule } from './knowledge-articles/knowledge-articles.module';
import { MachineModelsModule } from './machine-models/machine-models.module';
import { MachineComponentsModule } from './machine-components/machine-components.module';
import { MachinesModule } from './machines/machines.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductIndustriesModule } from './product-industries/product-industries.module';
import { RegionsModule } from './regions/regions.module';
import { ReportsModule } from './reports/reports.module';
import { RepairsModule } from './repairs/repairs.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { WeeklyReportsModule } from './weekly-reports/weekly-reports.module';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { WorkOperationsModule } from './work-operations/work-operations.module';

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
    ApplicationSupportModule,
    AuditLogsModule,
    AttachmentsModule,
    AuthModule,
    BusinessLinesModule,
    UsersModule,
    RolesModule,
    RegionsModule,
    CustomersModule,
    DailyWorkNotesModule,
    DailyReportsModule,
    MachinesModule,
    DashboardModule,
    DemoLoansModule,
    RepairsModule,
    EngineerProfilesModule,
    MaintenanceModule,
    NotificationsModule,
    InventoryMovementsModule,
    InstallationsModule,
    KnowledgeArticlesModule,
    MachineModelsModule,
    MachineComponentsModule,
    ProductIndustriesModule,
    WeeklyReportsModule,
    ReportsModule,
    WorkOperationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {}
