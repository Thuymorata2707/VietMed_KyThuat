import { Module } from '@nestjs/common';
import { DailyWorkNotesController } from './daily-work-notes.controller';
import { DailyWorkNotesService } from './daily-work-notes.service';

@Module({
  controllers: [DailyWorkNotesController],
  providers: [DailyWorkNotesService],
})
export class DailyWorkNotesModule {}
