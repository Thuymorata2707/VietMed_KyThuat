import { Module } from '@nestjs/common';
import { AccessoryInventoryController } from './accessory-inventory.controller';
import { AccessoryInventoryService } from './accessory-inventory.service';

@Module({
  controllers: [AccessoryInventoryController],
  providers: [AccessoryInventoryService],
})
export class AccessoryInventoryModule {}
