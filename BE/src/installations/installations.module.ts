import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InstallationsController } from './installations.controller';
import { InstallationsService } from './installations.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [InstallationsController],
  providers: [InstallationsService],
})
export class InstallationsModule {}
