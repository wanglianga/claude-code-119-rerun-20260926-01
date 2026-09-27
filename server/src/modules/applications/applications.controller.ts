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
import { IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApplicationsService } from './applications.service';
import { AssignOnsiteDto, CreateScreeningDto } from './dto';

class CancelDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('screenings')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // 申请方提交放映申请
  @Roles(UserRole.APPLICANT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScreeningDto) {
    return this.service.create(user, dto);
  }

  // 各角色查看场次列表（申请方仅看本主办方）
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.list(user, status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  // 街道/审核员可取消；申请方可取消自己的场次
  @Roles(UserRole.APPLICANT, UserRole.STREET, UserRole.AUDITOR)
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.service.cancel(user, id, dto.reason || '');
  }

  // 审核通过后指派现场负责人（审核员或街道）
  @Roles(UserRole.AUDITOR, UserRole.STREET)
  @Post(':id/assign-onsite')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignOnsiteDto,
  ) {
    return this.service.assignOnsite(user, id, dto);
  }
}
