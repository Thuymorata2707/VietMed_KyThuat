import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '../../common/request-user.type';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { normalizeRoleName } from '../permissions';

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const roleName = normalizeRoleName(request.user?.roleName);

    return Boolean(roleName && requiredRoles.includes(roleName));
  }
}
