import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CreditRecord,
  DepositTransaction,
  Organization,
  Screening,
  TimelineEvent,
  Venue,
} from '../../entities';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Screening,
      Organization,
      DepositTransaction,
      CreditRecord,
      Venue,
      TimelineEvent,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
