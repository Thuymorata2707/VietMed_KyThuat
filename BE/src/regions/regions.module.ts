import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({
  imports: [AuthModule],
  controllers: [RegionsController],
  providers: [RegionsService],
})
export class RegionsModule {}
