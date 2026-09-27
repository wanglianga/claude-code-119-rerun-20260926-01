import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screening } from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Screening]), TimelineModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
