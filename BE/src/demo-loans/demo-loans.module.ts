import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DemoLoansController } from './demo-loans.controller';
import { DemoLoansService } from './demo-loans.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [DemoLoansController],
  providers: [DemoLoansService],
  exports: [DemoLoansService],
})
export class DemoLoansModule {}
