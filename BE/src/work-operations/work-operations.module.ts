import { Module } from '@nestjs/common';
import { WorkOperationsController } from './work-operations.controller';
import { WorkOperationsService } from './work-operations.service';

@Module({
  controllers: [WorkOperationsController],
  providers: [WorkOperationsService],
})
export class WorkOperationsModule {}
