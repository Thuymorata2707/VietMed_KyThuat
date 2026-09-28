import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService login', () => {
  const password = 'unit-test-only-password';
  let service: AuthService;
  let prisma: { user: { findFirst: jest.Mock } };
  let jwtService: { sign: jest.Mock };
  let loginThrottle: {
    recordFailure: jest.Mock;
    recordSuccess: jest.Mock;
    isLocked: jest.Mock;
  };

  beforeEach(async () => {
    prisma = { user: { findFirst: jest.fn() } };
    jwtService = { sign: jest.fn().mockReturnValue('unit-test-token') };
    loginThrottle = {
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
      isLocked: jest.fn().mockReturnValue(false),
    };
    service = new AuthService(
      prisma as never,
      jwtService as never,
      loginThrottle as never,
    );

    prisma.user.findFirst.mockResolvedValue({
      id: 'admin-test',
      email: 'admin@example.test',
      username: 'admin',
      password: await bcrypt.hash(password, 4),
      fullName: 'Test Admin',
      phone: null,
      status: 'ACTIVE',
      roleId: 'role-admin',
      role: { id: 'role-admin', name: 'admin' },
      regionId: null,
      region: null,
      engineerProfile: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  it.each([' ADMIN@EXAMPLE.TEST ', ' ADMIN '])(
    'accepts a normalized email or username identifier (%s)',
    async (identifier) => {
      const result = await service.login({ identifier, password });

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: identifier.trim().toLowerCase() },
              { username: identifier.trim().toLowerCase() },
            ],
          },
        }),
      );
      expect(result.accessToken).toBe('unit-test-token');
      expect(result.user.email).toBe('admin@example.test');
      expect(loginThrottle.recordSuccess).toHaveBeenCalledWith(
        identifier.trim().toLowerCase(),
        undefined,
      );
    },
  );

  it('rejects a wrong password without issuing a token', async () => {
    await expect(
      service.login({ identifier: 'admin@example.test', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.sign).not.toHaveBeenCalled();
    expect(loginThrottle.recordFailure).toHaveBeenCalledWith(
      'admin@example.test',
      undefined,
    );
  });
});
