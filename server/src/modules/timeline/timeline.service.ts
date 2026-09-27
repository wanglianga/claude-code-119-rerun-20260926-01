import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screening, TimelineEvent } from '../../entities';

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(TimelineEvent)
    private readonly eventRepo: Repository<TimelineEvent>,
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
  ) {}

  async log(params: {
    screeningId: string;
    phase: string;
    title: string;
    detail?: string;
    actorName: string;
    actorRole: string;
  }) {
    const ev = this.eventRepo.create({
      screeningId: params.screeningId,
      phase: params.phase,
      title: params.title,
      detail: params.detail || '',
      actorName: params.actorName,
      actorRole: params.actorRole,
    });
    return this.eventRepo.save(ev);
  }

  /** 推进场次状态并记录时间线 */
  async transition(params: {
    screening: Screening;
    toStatus: string;
    phase: string;
    title: string;
    detail?: string;
    actorName: string;
    actorRole: string;
  }) {
    params.screening.status = params.toStatus as any;
    await this.screeningRepo.save(params.screening);
    return this.log({
      screeningId: params.screening.id,
      phase: params.phase,
      title: params.title,
      detail: params.detail,
      actorName: params.actorName,
      actorRole: params.actorRole,
    });
  }

  list(screeningId: string) {
    return this.eventRepo.find({
      where: { screeningId },
      order: { createdAt: 'ASC' },
    });
  }
}
