import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OnsiteCheck,
  Screening,
  TimelineEvent,
  VolunteerCheckin,
} from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { OnsiteController } from './onsite.controller';
import { OnsiteService } from './onsite.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OnsiteCheck,
      Screening,
      VolunteerCheckin,
      TimelineEvent,
    ]),
    TimelineModule,
  ],
  controllers: [OnsiteController],
  providers: [OnsiteService],
})
export class OnsiteModule {}
