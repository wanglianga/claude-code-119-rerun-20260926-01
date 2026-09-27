import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { EquipmentCategory, UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WarehouseService } from './warehouse.service';

class CreateItemDto {
  @IsString()
  qrCode: string;

  @IsString()
  name: string;

  @IsIn([
    EquipmentCategory.PROJECTOR,
    EquipmentCategory.SCREEN,
    EquipmentCategory.SPEAKER,
    EquipmentCategory.CABLE,
    EquipmentCategory.BULB,
    EquipmentCategory.RAIN_COVER,
  ])
  category: EquipmentCategory;

  @IsNumberString()
  value: string;
}

class ScanDto {
  @IsString()
  qrCode: string;

  @IsIn(['ISSUE', 'RETURN'])
  action: 'ISSUE' | 'RETURN';

  @IsBoolean()
  @IsOptional()
  damaged?: boolean;

  @IsString()
  @IsOptional()
  remark?: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  // 设备库存台账
  @Get('equipment')
  list(
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.service.listItems(status, category);
  }

  // 登记新设备入库（仓库角色）
  @Roles(UserRole.WAREHOUSE)
  @Post('equipment')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateItemDto) {
    return this.service.createItem(user, dto);
  }

  // 场次成套清单
  @Get('screenings/:id/kit')
  kit(@Param('id') id: string) {
    return this.service.getKit(id);
  }

  // 仓库按场次备货（六大类成套预占）
  @Roles(UserRole.WAREHOUSE)
  @Post('screenings/:id/kit/prepare')
  prepare(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.prepareKit(user, id);
  }

  // 扫码领取/归还，成套核对
  @Roles(UserRole.WAREHOUSE, UserRole.ONSITE)
  @Post('screenings/:id/scan')
  scan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ScanDto,
  ) {
    return this.service.scan(user, id, dto.qrCode, dto.action, {
      damaged: dto.damaged,
      remark: dto.remark,
    });
  }

  @Get('screenings/:id/scan-logs')
  logs(@Param('id') id: string) {
    return this.service.scanLogs(id);
  }

  @Get('screenings/:id/damaged-items')
  damaged(@Param('id') id: string) {
    return this.service.damagedItems(id);
  }
}
