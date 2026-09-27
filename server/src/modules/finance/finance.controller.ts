import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FinanceService } from './finance.service';

class SettleDto {
  @IsNumberString()
  @IsOptional()
  compensation?: string;

  @IsNumberString()
  @IsOptional()
  subsidy?: string;

  @IsBoolean()
  copyrightWriteOff: boolean;

  @IsString()
  @IsOptional()
  reviewConclusion?: string;
}

class RechargeDto {
  @IsUUID()
  orgId: string;

  @IsNumberString()
  amount: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // 财务统一核销：赔付+押金清算+补贴+版权核销+信用联动
  @Roles(UserRole.FINANCE, UserRole.STREET)
  @Post('screenings/:id/settle')
  settle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SettleDto,
  ) {
    return this.service.settle(user, id, {
      compensation: dto.compensation || '0',
      subsidy: dto.subsidy || '0',
      copyrightWriteOff: dto.copyrightWriteOff,
      reviewConclusion: dto.reviewConclusion,
    });
  }

  // 押金充值（财务代充，或申请方为本组织充）
  @Roles(UserRole.FINANCE, UserRole.APPLICANT)
  @Post('deposits/recharge')
  recharge(@CurrentUser() user: AuthUser, @Body() dto: RechargeDto) {
    if (user.role === 'APPLICANT' && dto.orgId !== user.orgId) {
      throw new BadRequestException('只能为本主办方充值');
    }
    return this.service.recharge(user, dto.orgId, dto.amount);
  }

  @Get('deposits/logs')
  logs(@CurrentUser() user: AuthUser, @Query('orgId') orgId?: string) {
    return this.service.depositLogs(
      user.role === 'APPLICANT' ? user.orgId : orgId,
    );
  }
}
