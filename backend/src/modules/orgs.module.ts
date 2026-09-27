import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { Organization, CreditRecord } from '../entities';
import { AuthGuard, Roles } from '../auth/auth.guard';

class DepositDto {
  @IsNumber() amount: number;
  @IsOptional() @IsString() remark?: string;
}

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrgsController {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
    @InjectRepository(CreditRecord) private readonly creditRepo: Repository<CreditRecord>,
  ) {}

  @Get()
  list() {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.repo.findOneByOrFail({ id });
  }

  @Get(':id/credit-records')
  creditRecords(@Param('id') id: string) {
    return this.creditRepo.find({ where: { organizationId: id }, order: { createdAt: 'DESC' } });
  }

  // 财务充值押金
  @Roles('FINANCE')
  @Post(':id/deposit')
  async addDeposit(@Param('id') id: string, @Body() dto: DepositDto) {
    const org = await this.repo.findOneByOrFail({ id });
    org.depositBalance = +(org.depositBalance + dto.amount).toFixed(2);
    await this.repo.save(org);
    return org;
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Organization, CreditRecord])],
  controllers: [OrgsController],
  exports: [TypeOrmModule],
})
export class OrgsModule {}
