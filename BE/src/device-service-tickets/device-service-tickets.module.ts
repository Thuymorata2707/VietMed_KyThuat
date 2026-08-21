import { Module } from '@nestjs/common';
import { DeviceServiceTicketsController } from './device-service-tickets.controller';
import { DeviceServiceTicketsService } from './device-service-tickets.service';

@Module({
  controllers: [DeviceServiceTicketsController],
  providers: [DeviceServiceTicketsService],
  exports: [DeviceServiceTicketsService],
})
export class DeviceServiceTicketsModule {}
