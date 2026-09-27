import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimelineEvent, User } from '../entities';

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(TimelineEvent) private readonly repo: Repository<TimelineEvent>,
  ) {}

  async log(sessionId: string, eventType: string, title: string, detail: string | null, actor?: Partial<User>) {
    const ev = this.repo.create({
      sessionId,
      eventType,
      title,
      detail,
      actorUserId: actor?.id || null,
      actorName: actor?.name || null,
    });
    await this.repo.save(ev);
    return ev;
  }
}
