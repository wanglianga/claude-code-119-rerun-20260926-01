import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TimelineService } from './timeline.service';

@UseGuards(AuthGuard('jwt'))
@Controller('screenings/:id/timeline')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  list(@Param('id') id: string) {
    return this.timeline.list(id);
  }
}
