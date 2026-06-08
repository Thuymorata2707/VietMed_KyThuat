import { Module } from '@nestjs/common';
import { MachineComponentsController } from './machine-components.controller';
import { MachineComponentsService } from './machine-components.service';

@Module({
  controllers: [MachineComponentsController],
  providers: [MachineComponentsService],
  exports: [MachineComponentsService],
})
export class MachineComponentsModule {}
