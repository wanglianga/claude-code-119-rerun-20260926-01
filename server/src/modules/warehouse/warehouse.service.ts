import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  EquipmentCategory,
  EquipmentItem,
  EquipmentKitItem,
  EquipmentScanLog,
  Screening,
  ScreeningStatus,
  TimelineEvent,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';

const CATEGORY_LABEL: Record<string, string> = {
  PROJECTOR: '投影机',
  SCREEN: '幕布',
  SPEAKER: '音箱',
  CABLE: '电缆',
  BULB: '备用灯泡',
  RAIN_COVER: '防雨罩',
};

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(EquipmentItem)
    private readonly itemRepo: Repository<EquipmentItem>,
    @InjectRepository(EquipmentKitItem)
    private readonly kitRepo: Repository<EquipmentKitItem>,
    @InjectRepository(EquipmentScanLog)
    private readonly scanRepo: Repository<EquipmentScanLog>,
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    private readonly timeline: TimelineService,
    private readonly dataSource: DataSource,
  ) {}

  label(cat: string) {
    return CATEGORY_LABEL[cat] || cat;
  }

  listItems(status?: string, category?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    return this.itemRepo.find({ where, order: { qrCode: 'ASC' } });
  }

  async createItem(user: AuthUser, dto: {
    qrCode: string;
    name: string;
    category: EquipmentCategory;
    value: string;
  }) {
    const exists = await this.itemRepo.findOne({ where: { qrCode: dto.qrCode } });
    if (exists) throw new BadRequestException('条码已存在');
    const item = this.itemRepo.create({
      qrCode: dto.qrCode,
      name: dto.name,
      category: dto.category,
      value: dto.value,
      status: 'IDLE',
    });
    return this.itemRepo.save(item);
  }

  async getKit(screeningId: string) {
    return this.kitRepo.find({
      where: { screeningId },
      relations: { equipmentItem: true },
      order: { category: 'ASC' },
    });
  }

  /** 仓库按场次准备六大类成套设备并预占库存 */
  async prepareKit(user: AuthUser, screeningId: string) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new BadRequestException('场次不存在');
    if (!['APPROVED'].includes(s.status)) {
      throw new BadRequestException('仅审核通过的场次可以备货');
    }
    const existed = await this.kitRepo.count({ where: { screeningId } });
    if (existed > 0) throw new BadRequestException('该场次已完成备货');

    const demand: Array<[EquipmentCategory, number]> = [
      [EquipmentCategory.PROJECTOR, 1],
      [EquipmentCategory.SCREEN, 1],
      [EquipmentCategory.SPEAKER, s.speakerCount],
      [EquipmentCategory.CABLE, 2],
      [EquipmentCategory.BULB, 1],
      [EquipmentCategory.RAIN_COVER, 1],
    ];

    await this.dataSource.transaction(async (manager) => {
      for (const [category, qty] of demand) {        const idle = await manager.find(EquipmentItem, {
          where: { category, status: 'IDLE' },
          order: { qrCode: 'ASC' },
          take: qty,
        });
        if (idle.length < qty) {
          throw new BadRequestException(
            `${this.label(category)}库存不足：需要 ${qty} 件，空闲 ${idle.length} 件`,
          );
        }
        idle.forEach((it) => (it.status = 'RESERVED'));
        await manager.save(idle);
        // 每个需求件一行，领取时逐件扫码
        for (const it of idle) {
          await manager.save(
            manager.create(EquipmentKitItem, {
              screeningId,
              category,
              requiredQty: 1,
              equipmentItemId: it.id,
              status: 'PREPARED',
              preparedAt: new Date(),
            }),
          );
        }
      }
      s.status = ScreeningStatus.EQUIPPED;
      await manager.save(s);
      await manager.save(
        manager.create(TimelineEvent, {
          screeningId,
          phase: 'EQUIP',
          title: '仓库完成成套备货',
          detail: demand
            .map(([c, q]) => `${this.label(c)}×${q}`)
            .join('、'),
          actorName: user.name,
          actorRole: user.role,
        }),
      );
    });
    // 事务提交后再通过主连接查询成套清单
    return this.getKit(screeningId);
  }

  /** 扫码：领取出库 / 归还，逐件核对成套状态 */
  async scan(
    user: AuthUser,
    screeningId: string,
    qrCode: string,
    action: 'ISSUE' | 'RETURN',
    options: { damaged?: boolean; remark?: string } = {},
  ) {
    const item = await this.itemRepo.findOne({ where: { qrCode } });
    if (!item) throw new BadRequestException(`条码 ${qrCode} 不存在`);
    const kitRows = await this.kitRepo.find({
      where: { screeningId, category: item.category as EquipmentCategory },
      relations: { equipmentItem: true },
    });
    const row = kitRows.find((k) => k.equipmentItemId === item.id);
    if (!row) {
      throw new BadRequestException(
        `设备 ${qrCode}（${this.label(item.category)}）不属于本场成套清单，成套核对不通过`,
      );
    }

    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });

    if (action === 'ISSUE') {
      if (row.status === 'SCANNED') {
        throw new BadRequestException('该设备已扫码出库，请勿重复扫码');
      }
      row.status = 'SCANNED';
      row.scannedCode = qrCode;
      row.scannedAt = new Date();
      item.status = 'ISSUED';
      await this.kitRepo.save(row);
      await this.itemRepo.save(item);
      await this.scanRepo.save(
        this.scanRepo.create({
          screeningId,
          equipmentItemId: item.id,
          action: 'ISSUE',
          matched: true,
          operatorName: user.name,
        }),
      );
      // 成套核对：全部扫码完成则出库
      const all = await this.kitRepo.find({ where: { screeningId } });
      if (all.every((k) => k.status === 'SCANNED')) {
        await this.timeline.transition({
          screening: s,
          toStatus: ScreeningStatus.ISSUED,
          phase: 'ISSUE',
          title: '设备成套扫码核对完成，已领取出库',
          detail: `共 ${all.length} 件全部核对一致`,
          actorName: user.name,
          actorRole: user.role,
        });

    }
    } else {
      // RETURN
      if (options.damaged) {
        row.status = 'DAMAGED';
        row.remark = options.remark || '归还时发现损坏';
        item.status = 'DAMAGED';
        item.remark = options.remark || '归还时发现损坏';
        s.hasDamageIssue = true;
      } else {
        row.status = 'SCANNED';
        item.status = 'IDLE';
      }
      await this.kitRepo.save(row);
      await this.itemRepo.save(item);
      await this.screeningRepo.save(s);
      await this.scanRepo.save(
        this.scanRepo.create({
          screeningId,
          equipmentItemId: item.id,
          action: 'RETURN',
          matched: !options.damaged,
          operatorName: user.name,
        }),
      );
      const all = await this.kitRepo.find({ where: { screeningId } });
      const returned = all.filter(
        (k) => k.status === 'SCANNED' || k.status === 'DAMAGED',
      );
      if (returned.length === all.length) {
        const damaged = all.filter((k) => k.status === 'DAMAGED');
        await this.timeline.transition({
          screening: s,
          toStatus: ScreeningStatus.RETURNED,
          phase: 'RETURN',
          title: '设备全部归还入库',
          detail:
            damaged.length > 0
              ? `${damaged.length} 件损坏待赔付：${damaged
                  .map((d) => d.equipmentItem?.qrCode || d.category)
                  .join('、')}`
              : '设备完好',
          actorName: user.name,
          actorRole: user.role,
        });
      }
    }

    return {
      ok: true,
      item: { qrCode: item.qrCode, name: item.name, category: item.category, status: item.status },
      kit: await this.getKit(screeningId),
    };
  }

  scanLogs(screeningId: string) {
    return this.scanRepo.find({
      where: { screeningId },
      relations: { equipmentItem: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** 归还环节登记的损坏件（供财务赔付） */
  async damagedItems(screeningId: string) {
    return this.kitRepo.find({
      where: { screeningId, status: 'DAMAGED' },
      relations: { equipmentItem: true },
    });
  }
}
