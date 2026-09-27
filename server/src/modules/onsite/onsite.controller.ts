import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OnsiteService } from './onsite.service';

class ReportDto {
  @IsIn(['SETUP_PHOTO', 'TEST_PLAY', 'NOISE', 'AUDIENCE_ISOLATION', 'FIRE_LANE'])
  type: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  dbValue?: number;

  @IsOptional()
  qualified?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}

class FinishDto {
  @IsString()
  @IsOptional()
  note?: string;
}

class VolunteerDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  post: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('screenings/:id/onsite')
export class OnsiteController {
  constructor(private readonly service: OnsiteService) {}

  @Get('checks')
  checks(@Param('id') id: string) {
    return this.service.listChecks(id);
  }

  // 现场负责人上报：搭建照片/试播截图/噪声/隔离/消防通道
  @Roles(UserRole.ONSITE, UserRole.SECURITY)
  @Post('checks')
  report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReportDto,
  ) {
    return this.service.report(user, id, dto);
  }

  // 五项巡检达标后确认搭建、开始放映
  @Roles(UserRole.ONSITE)
  @Post('complete-setup')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.completeSetup(user, id);
  }

  @Roles(UserRole.ONSITE)
  @Post('finish')
  finish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FinishDto,
  ) {
    return this.service.finish(user, id, dto.note || '');
  }

  @Get('volunteers')
  volunteers(@Param('id') id: string) {
    return this.service.listVolunteers(id);
  }

  @Roles(UserRole.ONSITE, UserRole.APPLICANT)
  @Post('volunteers')
  checkin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VolunteerDto,
  ) {
    return this.service.checkin(user, id, dto);
  }

  @Roles(UserRole.ONSITE, UserRole.APPLICANT)
  @Post('volunteers/:vid/checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Param('vid') vid: string,
  ) {
    return this.service.checkout(user, vid);
  }
}
