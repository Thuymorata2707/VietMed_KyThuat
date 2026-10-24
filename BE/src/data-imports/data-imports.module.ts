import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DataImportsController } from './data-imports.controller';
import { DataImportsService } from './data-imports.service';

@Module({
  imports: [AuthModule],
  controllers: [DataImportsController],
  providers: [DataImportsService],
})
export class DataImportsModule {}
