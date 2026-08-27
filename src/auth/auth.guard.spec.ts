import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Role } from './roles.decorator';

describe('AuthGuard', () => {
  const tokens = { 'auth.adminToken': 'admin-secret', 'auth.readerToken': 'reader-secret' };

  const buildGuard = (
    options: { isPublic?: boolean; roles?: Role[]; config?: Record<string, string> } = {},
  ) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === IS_PUBLIC_KEY ? options.isPublic : options.roles,
      ),
    };
    const config = {
      get: jest.fn((key: string) => (options.config ?? tokens)[key]),
    };
    return new AuthGuard(reflector as any, config as any);
  };

  const buildContext = (authorization?: string): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    } as unknown as ExecutionContext);

  it('allows public routes without a token', () => {
    expect(buildGuard({ isPublic: true }).canActivate(buildContext())).toBe(true);
  });

  it('rejects a missing Authorization header', () => {
    expect(() => buildGuard().canActivate(buildContext())).toThrow(UnauthorizedException);
  });

  it('rejects a non-bearer Authorization header', () => {
    expect(() => buildGuard().canActivate(buildContext('Basic abc'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown token', () => {
    expect(() => buildGuard().canActivate(buildContext('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a reader token on routes without explicit roles', () => {
    expect(buildGuard().canActivate(buildContext('Bearer reader-secret'))).toBe(true);
  });

  it('accepts a case-insensitive bearer scheme', () => {
    expect(buildGuard().canActivate(buildContext('bearer reader-secret'))).toBe(true);
  });

  it('forbids a reader token on admin routes', () => {
    expect(() =>
      buildGuard({ roles: ['admin'] }).canActivate(buildContext('Bearer reader-secret')),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin token on admin routes', () => {
    expect(buildGuard({ roles: ['admin'] }).canActivate(buildContext('Bearer admin-secret'))).toBe(
      true,
    );
  });

  it('allows an admin token on reader routes', () => {
    expect(buildGuard().canActivate(buildContext('Bearer admin-secret'))).toBe(true);
  });

  it('never authenticates when tokens are not configured', () => {
    const guard = buildGuard({ config: { 'auth.adminToken': '', 'auth.readerToken': '' } });
    expect(() => guard.canActivate(buildContext('Bearer '))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(buildContext('Bearer anything'))).toThrow(UnauthorizedException);
  });
});
