import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DeviceServiceTicketsController } from './device-service-tickets.controller';
import { DeviceServiceTicketsService } from './device-service-tickets.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [DeviceServiceTicketsController],
  providers: [DeviceServiceTicketsService],
  exports: [DeviceServiceTicketsService],
})
export class DeviceServiceTicketsModule {}
