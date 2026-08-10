import { Module } from '@nestjs/common';
import { DemoLoansController } from './demo-loans.controller';
import { DemoLoansService } from './demo-loans.service';

@Module({
  controllers: [DemoLoansController],
  providers: [DemoLoansService],
  exports: [DemoLoansService],
})
export class DemoLoansModule {}
