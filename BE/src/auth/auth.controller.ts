import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RequestUser } from '../common/request-user.type';
import { AppConfigService } from '../config/app-config.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, this.getClientIp(request));
    this.setAuthCookie(response, result.accessToken);
    // The browser authenticates with the HttpOnly cookie. Do not also expose
    // the same bearer token to application JavaScript in the response body.
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    this.clearAuthCookie(response);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user, dto);
  }

  private getClientIp(request: Request) {
    // Express resolves request.ip using the configured trusted proxy chain.
    // Reading X-Forwarded-For directly would let clients spoof the throttle key.
    return request.ip;
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie(this.config.authCookieName, token, {
      domain: this.config.authCookieDomain,
      httpOnly: true,
      maxAge: this.config.jwtExpiresInSeconds * 1000,
      path: '/',
      sameSite: this.config.authCookieSameSite,
      secure: this.config.authCookieSecure,
    });
  }

  private clearAuthCookie(response: Response) {
    response.clearCookie(this.config.authCookieName, {
      domain: this.config.authCookieDomain,
      path: '/',
      sameSite: this.config.authCookieSameSite,
      secure: this.config.authCookieSecure,
    });
  }
}
