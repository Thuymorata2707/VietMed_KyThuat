import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { BusinessLinesController } from './business-lines.controller';
import { BusinessLinesService } from './business-lines.service';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [BusinessLinesController],
  providers: [BusinessLinesService],
})
export class BusinessLinesModule {}
