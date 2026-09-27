import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

class ApproveDto {
  @IsBoolean()
  copyrightConfirmed: boolean;

  @IsBoolean()
  recordConfirmed: boolean;

  @IsString()
  @IsOptional()
  remark?: string;
}

class RejectDto {
  @IsString()
  reason: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.AUDITOR)
@Controller('screenings/:id/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Post('approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveDto,
  ) {
    return this.service.approve(
      user,
      id,
      dto.copyrightConfirmed,
      dto.recordConfirmed,
      dto.remark || '',
    );
  }

  @Post('reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ) {
    return this.service.reject(user, id, dto.reason);
  }
}
