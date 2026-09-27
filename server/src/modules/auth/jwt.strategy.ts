import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from './current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'open-cinema-dev-secret-2026',
    });
  }

  async validate(payload: any): Promise<AuthUser> {
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      orgId: payload.orgId ?? null,
    };
  }
}
