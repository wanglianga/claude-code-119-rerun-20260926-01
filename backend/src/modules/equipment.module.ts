import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment, EquipStatus } from '../entities';
import { AuthGuard } from '../auth/auth.guard';

@Controller('equipment')
@UseGuards(AuthGuard)
export class EquipmentController {
  constructor(@InjectRepository(Equipment) private readonly repo: Repository<Equipment>) {}

  @Get()
  list(@Query('status') status?: EquipStatus, @Query('category') category?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    return this.repo.find({ where, order: { category: 'ASC', qrCode: 'ASC' } });
  }

  // 扫码核对：按二维码查询设备
  @Get('scan/:qrCode')
  scan(@Param('qrCode') qrCode: string) {
    return this.repo.findOne({ where: { qrCode } });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Equipment])],
  controllers: [EquipmentController],
  exports: [TypeOrmModule],
})
export class EquipmentModule {}
