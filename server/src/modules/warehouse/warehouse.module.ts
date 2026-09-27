import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EquipmentItem,
  EquipmentKitItem,
  EquipmentScanLog,
  Screening,
  TimelineEvent,
} from '../../entities';
import { TimelineModule } from '../timeline/timeline.module';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipmentItem,
      EquipmentKitItem,
      EquipmentScanLog,
      Screening,
      TimelineEvent,
    ]),
    TimelineModule,
  ],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
