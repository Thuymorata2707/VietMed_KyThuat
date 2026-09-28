import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../../common/request-user.type';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '../jwt.service';

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const payload = this.jwtService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        status: true,
        roleId: true,
        regionId: true,
        engineerProfile: { select: { expertiseGroup: true, expertiseImaging: true, expertiseLabTesting: true } },
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }

    const expertiseGroups = user.engineerProfile
      ? [user.engineerProfile.expertiseImaging ? 'IMAGING' : null, user.engineerProfile.expertiseLabTesting ? 'LAB_TESTING' : null]
          .filter((group): group is string => Boolean(group))
      : [];
    if (!expertiseGroups.length && (user.engineerProfile?.expertiseGroup === 'IMAGING' || user.engineerProfile?.expertiseGroup === 'LAB_TESTING')) {
      expertiseGroups.push(user.engineerProfile.expertiseGroup);
    }

    request.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      regionId: user.regionId,
      expertiseGroup: user.engineerProfile?.expertiseGroup ?? null,
      expertiseGroups,
    };

    return true;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;
    const cookieToken = this.extractCookieToken(request);

    if (cookieToken) {
      return cookieToken;
    }

    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    return token;
  }

  private extractCookieToken(request: Request) {
    const rawCookie = request.headers.cookie;
    if (!rawCookie) return '';

    const cookies = rawCookie.split(';');
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === this.config.authCookieName) {
        return decodeURIComponent(rawValue.join('='));
      }
    }

    return '';
  }
}
