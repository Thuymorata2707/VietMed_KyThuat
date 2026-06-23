import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  imports: [NotificationsModule],
  controllers: [WeeklyReportsController],
  providers: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
