import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../../common/request-user.type';
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

    request.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      regionId: user.regionId,
    };

    return true;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;
    const queryToken = typeof request.query?.token === 'string' ? request.query.token : '';

    if (queryToken) {
      return queryToken;
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
}
