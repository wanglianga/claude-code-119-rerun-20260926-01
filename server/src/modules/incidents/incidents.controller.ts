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
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentType, UserRole } from '../../entities';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IncidentsService } from './incidents.service';

class CreateIncidentDto {
  @IsIn([
    IncidentType.FILE_DAMAGED,
    IncidentType.MISSING_PART,
    IncidentType.NOISE_COMPLAINT,
    IncidentType.RAIN,
    IncidentType.OVERCROWD,
    IncidentType.POWER_TRIP,
    IncidentType.EXTENSION_REQ,
  ])
  type: IncidentType;

  @IsString()
  description: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  metricValue?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  severity?: number;
}

class MessageDto {
  @IsString()
  content: string;
}

class ResolveDto {
  @IsString()
  resolution: string;

  @IsOptional()
  approved?: boolean;

  @IsString()
  @IsOptional()
  complainant?: string;

  @IsString()
  @IsOptional()
  handleResult?: string;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  // 待处理异常工作台
  @Get('incidents/open')
  open(@CurrentUser() user: AuthUser) {
    return this.service.listOpen(user);
  }

  @Get('screenings/:id/incidents')
  list(@Param('id') id: string) {
    return this.service.listByScreening(id);
  }

  // 申请方/审核员/仓库/现场/安保/财务均可上报异常
  @Roles(
    UserRole.APPLICANT,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE,
    UserRole.ONSITE,
    UserRole.SECURITY,
    UserRole.FINANCE,
  )
  @Post('screenings/:id/incidents')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.service.create(user, id, dto);
  }

  // 六类角色围绕同一异常协同留言
  @Roles(
    UserRole.APPLICANT,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE,
    UserRole.ONSITE,
    UserRole.SECURITY,
    UserRole.FINANCE,
  )
  @Post('incidents/:incidentId/messages')
  message(
    @CurrentUser() user: AuthUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: MessageDto,
  ) {
    return this.service.postMessage(user, incidentId, dto.content);
  }

  @Roles(
    UserRole.APPLICANT,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE,
    UserRole.ONSITE,
    UserRole.SECURITY,
    UserRole.FINANCE,
  )
  @Post('incidents/:incidentId/resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: ResolveDto,
  ) {
    return this.service.resolve(user, incidentId, dto.resolution, {
      approved: dto.approved,
      complainant: dto.complainant,
      handleResult: dto.handleResult,
    });
  }

  // 投诉处理台账
  @Get('complaints')
  complaints(@Query('screeningId') screeningId?: string) {
    return this.service.listComplaints(screeningId);
  }
}
