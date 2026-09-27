import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DepositTransaction,
  Organization,
  Screening,
  TimelineEvent,
  User,
  Venue,
} from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Screening,
      Venue,
      Organization,
      DepositTransaction,
      User,
      TimelineEvent,
    ]),
    TimelineModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService, TypeOrmModule],
})
export class ApplicationsModule {}
