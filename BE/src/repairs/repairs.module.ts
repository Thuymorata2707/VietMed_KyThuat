import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RepairsController } from './repairs.controller';
import { RepairsService } from './repairs.service';

@Module({
  imports: [AuthModule, AuditLogsModule, NotificationsModule],
  controllers: [RepairsController],
  providers: [RepairsService],
})
export class RepairsModule {}
