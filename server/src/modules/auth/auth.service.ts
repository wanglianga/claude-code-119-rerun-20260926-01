import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: { org: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
    });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        orgId: user.orgId,
        orgName: user.org?.name ?? null,
      },
    };
  }

  async profile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { org: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      orgId: user.orgId,
      orgName: user.org?.name ?? null,
    };
  }
}
