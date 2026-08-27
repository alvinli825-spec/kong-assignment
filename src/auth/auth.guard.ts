import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Role, ROLES_KEY } from './roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const role = this.resolveRole(token);
    if (!role) {
      throw new UnauthorizedException('Invalid token');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? ['reader'];

    // Admin can do everything a reader can.
    if (role === 'admin' || requiredRoles.includes(role)) {
      return true;
    }
    throw new ForbiddenException(`Requires role: ${requiredRoles.join(', ')}`);
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  private resolveRole(token: string): Role | null {
    const adminToken = this.config.get<string>('auth.adminToken');
    const readerToken = this.config.get<string>('auth.readerToken');
    if (adminToken && token === adminToken) {
      return 'admin';
    }
    if (readerToken && token === readerToken) {
      return 'reader';
    }
    return null;
  }
}
