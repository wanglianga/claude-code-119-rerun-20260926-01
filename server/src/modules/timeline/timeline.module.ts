import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screening, TimelineEvent } from '../../entities';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

@Module({
  imports: [TypeOrmModule.forFeature([TimelineEvent, Screening])],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService, TypeOrmModule],
})
export class TimelineModule {}
