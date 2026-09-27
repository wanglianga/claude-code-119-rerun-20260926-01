import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Body, Controller, Get, Param, Post, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { Volunteer } from '../entities';
import { AuthGuard } from '../auth/auth.guard';

class AddVolunteerDto {
  @IsString() name: string;
  @IsString() phone: string;
  @IsOptional() @IsString() task?: string;
  @IsOptional() @IsString() checkInAt?: string;
}

@Controller('sessions/:id/volunteers')
@UseGuards(AuthGuard)
export class VolunteersController {
  constructor(@InjectRepository(Volunteer) private readonly repo: Repository<Volunteer>) {}

  @Get()
  list(@Param('id') id: string) {
    return this.repo.find({ where: { sessionId: id }, order: { createdAt: 'ASC' } });
  }

  // 登记志愿者并签到
  @Post()
  async add(@Param('id') id: string, @Body() dto: AddVolunteerDto, @Req() req: any) {
    const v = this.repo.create({
      sessionId: id,
      name: dto.name,
      phone: dto.phone,
      task: dto.task || null,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : new Date(),
      registeredBy: req.user.sub,
    });
    return this.repo.save(v);
  }

  @Post(':vid/checkout')
  async checkout(@Param('vid') vid: string) {
    const v = await this.repo.findOneByOrFail({ id: vid });
    if (!v.checkInAt) throw new BadRequestException('尚未签到');
    if (v.checkOutAt) throw new BadRequestException('已签退');
    v.checkOutAt = new Date();
    return this.repo.save(v);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Volunteer])],
  controllers: [VolunteersController],
})
export class VolunteersModule {}
