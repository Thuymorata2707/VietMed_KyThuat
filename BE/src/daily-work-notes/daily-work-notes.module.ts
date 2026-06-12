import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DailyWorkNotesController } from './daily-work-notes.controller';
import { DailyWorkNotesService } from './daily-work-notes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DailyWorkNotesController],
  providers: [DailyWorkNotesService],
})
export class DailyWorkNotesModule {}
