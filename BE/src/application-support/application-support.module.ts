import { Module } from '@nestjs/common';
import { ApplicationSupportController } from './application-support.controller';
import { ApplicationSupportService } from './application-support.service';

@Module({
  controllers: [ApplicationSupportController],
  providers: [ApplicationSupportService],
  exports: [ApplicationSupportService],
})
export class ApplicationSupportModule {}
