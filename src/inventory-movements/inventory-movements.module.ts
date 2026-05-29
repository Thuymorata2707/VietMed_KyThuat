import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';

@Module({
  imports: [AuthModule],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService],
})
export class InventoryMovementsModule {}
