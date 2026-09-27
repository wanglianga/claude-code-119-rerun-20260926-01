import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgsService } from './orgs.service';

class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsNumber()
  @IsOptional()
  lat?: number;
}

class BlacklistDto {
  @IsBoolean()
  blacklisted: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class OrgsController {
  constructor(private readonly service: OrgsService) {}

  // ---- 主办方与信用 ----
  @Get('orgs')
  orgs() {
    return this.service.listOrgs();
  }

  @Get('credits')
  credits(@Query('orgId') orgId?: string) {
    return this.service.creditRecords(orgId);
  }

  // ---- 场地与黑名单 ----
  @Get('venues')
  venues() {
    return this.service.listVenues();
  }

  @Roles(UserRole.STREET)
  @Post('venues')
  createVenue(@Body() dto: CreateVenueDto) {
    return this.service.createVenue(dto);
  }

  @Roles(UserRole.STREET)
  @Post('venues/:id/blacklist')
  blacklist(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BlacklistDto,
  ) {
    return this.service.setBlacklist(
      user,
      id,
      dto.blacklisted,
      dto.reason || '',
    );
  }

  @Get('venues/:id/blacklist-history')
  blacklistHistory(@Param('id') id: string) {
    return this.service.blacklistHistory(id);
  }

  // ---- 人员 ----
  @Get('onsite-managers')
  managers() {
    return this.service.onsiteManagers();
  }

  // ---- 街道文体岗看板 ----
  @Roles(UserRole.STREET, UserRole.AUDITOR, UserRole.FINANCE)
  @Get('street/dashboard')
  dashboard() {
    return this.service.dashboard();
  }
}
