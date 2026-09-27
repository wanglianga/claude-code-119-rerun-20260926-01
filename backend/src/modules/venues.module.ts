import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { Venue } from '../entities';
import { AuthGuard, Roles } from '../auth/auth.guard';

class BlacklistDto {
  @IsBoolean() blacklisted: boolean;
  @IsOptional() @IsString() reason?: string;
}

@Controller('venues')
@UseGuards(AuthGuard)
export class VenuesController {
  constructor(@InjectRepository(Venue) private readonly repo: Repository<Venue>) {}

  @Get()
  list() {
    return this.repo.find({ order: { noiseEventCount: 'DESC' } });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.repo.findOneByOrFail({ id });
  }

  // 街道文体岗设置/解除场地黑名单
  @Roles('STREET_ADMIN', 'CULTURE_REVIEWER')
  @Post(':id/blacklist')
  async blacklist(@Param('id') id: string, @Body() dto: BlacklistDto, @Req() req: any) {
    const venue = await this.repo.findOneByOrFail({ id });
    venue.blacklisted = dto.blacklisted;
    venue.blacklistReason = dto.blacklisted ? dto.reason || null : null;
    venue.blacklistSource = dto.blacklisted ? `${req.user.name} 手动拉黑` : null;
    venue.blacklistedAt = dto.blacklisted ? new Date() : null;
    await this.repo.save(venue);
    return venue;
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [VenuesController],
})
export class VenuesModule {}
