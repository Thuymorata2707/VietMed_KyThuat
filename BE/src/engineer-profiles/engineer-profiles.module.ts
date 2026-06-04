import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EngineerProfilesController } from './engineer-profiles.controller';
import { EngineerProfilesService } from './engineer-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [EngineerProfilesController],
  providers: [EngineerProfilesService],
})
export class EngineerProfilesModule {}
