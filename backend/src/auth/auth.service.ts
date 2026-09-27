import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Inject } from '@nestjs/common';
import { User } from '../entities';
import { JWT_SERVICE } from './jwt.module';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(JWT_SERVICE) private readonly jwt: any,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const payload = { sub: user.id, username: user.username, name: user.name, role: user.role, organizationId: user.organizationId };
    return { token: this.jwt.sign(payload), user: payload };
  }
}
