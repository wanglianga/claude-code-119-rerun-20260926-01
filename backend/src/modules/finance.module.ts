import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Body, Controller, Get, Param, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { FinanceRecord, Organization } from '../entities';
import { AuthGuard, Roles } from '../auth/auth.guard';

class OrgDepositDto {
  @IsNumber() amount: number;
  @IsOptional() @IsString() remark?: string;
}

@Controller('finance')
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(
    @InjectRepository(FinanceRecord) private readonly repo: Repository<FinanceRecord>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
  ) {}

  @Get('records')
  records() {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 300 });
  }

  // 财务向主办方收取设备押金
  @Roles('FINANCE')
  @Post('deposit/:organizationId')
  async deposit(@Param('organizationId') organizationId: string, @Body() dto: OrgDepositDto, @Req() req: any) {
    const org = await this.orgs.findOneByOrFail({ id: organizationId });
    org.depositBalance = +(org.depositBalance + dto.amount).toFixed(2);
    await this.orgs.save(org);
    return this.repo.save(this.repo.create({
      sessionId: null,
      organizationId,
      type: 'DEPOSIT',
      amount: dto.amount,
      status: 'CONFIRMED',
      remark: dto.remark || '设备押金收取',
      operatorUserId: req.user.sub,
    }));
  }

  // 退还押金
  @Roles('FINANCE')
  @Post('deposit-refund/:organizationId')
  async refund(@Param('organizationId') organizationId: string, @Body() dto: OrgDepositDto, @Req() req: any) {
    const org = await this.orgs.findOneByOrFail({ id: organizationId });
    if (dto.amount > org.depositBalance) {
      throw new BadRequestException('退还金额不能大于押金余额');
    }
    org.depositBalance = +(org.depositBalance - dto.amount).toFixed(2);
    await this.orgs.save(org);
    return this.repo.save(this.repo.create({
      sessionId: null,
      organizationId,
      type: 'DEPOSIT_REFUND',
      amount: dto.amount,
      status: 'PAID',
      remark: dto.remark || '设备押金退还',
      operatorUserId: req.user.sub,
    }));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([FinanceRecord, Organization])],
  controllers: [FinanceController],
})
export class FinanceModule {}
