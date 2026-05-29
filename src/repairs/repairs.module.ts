import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepairsController } from './repairs.controller';
import { RepairsService } from './repairs.service';

@Module({
  imports: [AuthModule],
  controllers: [RepairsController],
  providers: [RepairsService],
})
export class RepairsModule {}
