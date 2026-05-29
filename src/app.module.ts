import { Module } from '@nestjs/common';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { BusinessLinesModule } from './business-lines/business-lines.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EngineerProfilesModule } from './engineer-profiles/engineer-profiles.module';
import { InventoryMovementsModule } from './inventory-movements/inventory-movements.module';
import { MachinesModule } from './machines/machines.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegionsModule } from './regions/regions.module';
import { RepairsModule } from './repairs/repairs.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    BusinessLinesModule,
    UsersModule,
    RolesModule,
    RegionsModule,
    CustomersModule,
    MachinesModule,
    DashboardModule,
    RepairsModule,
    EngineerProfilesModule,
    MaintenanceModule,
    InventoryMovementsModule,
  ],
})
export class AppModule {}
