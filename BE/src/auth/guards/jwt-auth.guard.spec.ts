import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = {
    verify: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: {},
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    request.user = undefined;
  });

  it('rejects requests without bearer token', async () => {
    const guard = new JwtAuthGuard(jwtService as never, prisma as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive users even when the token is valid', async () => {
    jwtService.verify.mockReturnValue({ id: 'user-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'inactive@example.com',
      status: 'INACTIVE',
      roleId: 'role-1',
      regionId: 'region-1',
      role: { name: 'engineer' },
    });
    request.headers.authorization = 'Bearer valid-token';
    const guard = new JwtAuthGuard(jwtService as never, prisma as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refreshes request user from the database for active users', async () => {
    jwtService.verify.mockReturnValue({
      id: 'user-1',
      email: 'old@example.com',
      roleId: 'old-role',
      roleName: 'engineer',
      regionId: 'old-region',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'active@example.com',
      status: 'ACTIVE',
      roleId: 'role-1',
      regionId: 'region-1',
      role: { name: 'admin' },
    });
    request.headers.authorization = 'Bearer valid-token';
    const guard = new JwtAuthGuard(jwtService as never, prisma as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'active@example.com',
      roleId: 'role-1',
      roleName: 'admin',
      regionId: 'region-1',
    });
  });
});
