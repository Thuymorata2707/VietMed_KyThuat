import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtService } from './jwt.service';
import { LoginThrottleService } from './login-throttle.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtService, LoginThrottleService, RolesGuard],
  exports: [JwtService, RolesGuard],
})
export class AuthModule {}
