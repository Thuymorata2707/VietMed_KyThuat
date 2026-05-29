import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessLinesController } from './business-lines.controller';
import { BusinessLinesService } from './business-lines.service';

@Module({
  imports: [AuthModule],
  controllers: [BusinessLinesController],
  providers: [BusinessLinesService],
})
export class BusinessLinesModule {}
