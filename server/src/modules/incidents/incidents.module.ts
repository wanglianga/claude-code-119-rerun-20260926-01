import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Complaint,
  Incident,
  IncidentMessage,
  Screening,
  TimelineEvent,
  Venue,
} from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      IncidentMessage,
      Complaint,
      Screening,
      Venue,
      TimelineEvent,
    ]),
    TimelineModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
