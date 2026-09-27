import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CreditRecord,
  Organization,
  Screening,
  TimelineEvent,
  User,
  Venue,
  VenueBlacklistRecord,
} from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      CreditRecord,
      Venue,
      VenueBlacklistRecord,
      User,
      Screening,
      TimelineEvent,
    ]),
    TimelineModule,
  ],
  controllers: [OrgsController],
  providers: [OrgsService],
})
export class OrgsModule {}
