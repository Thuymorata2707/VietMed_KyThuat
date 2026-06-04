import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MachineModelsController } from './machine-models.controller';
import { MachineModelsService } from './machine-models.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MachineModelsController],
  providers: [MachineModelsService],
  exports: [MachineModelsService],
})
export class MachineModelsModule {}
