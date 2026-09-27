import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWT_SERVICE } from './jwt.module';
import { UserRole } from '../entities';

export const ROLES_KEY = 'roles';
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JWT_SERVICE) private readonly jwt: any,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('未登录');
    try {
      req.user = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
    const roles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler());
    if (roles && !roles.includes(req.user.role)) {
      throw new ForbiddenException('当前角色无权操作');
    }
    return true;
  }
}
