import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtService } from './jwt.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtService, RolesGuard],
  exports: [JwtService, RolesGuard],
})
export class AuthModule {}
