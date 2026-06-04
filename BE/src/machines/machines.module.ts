import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [MachinesController],
  providers: [MachinesService],
})
export class MachinesModule {}
