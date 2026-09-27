import {
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScreeningDto {
  @IsUUID()
  venueId: string;

  @IsString()
  @IsNotEmpty({ message: '放映日期必填' })
  screeningDate: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsNotEmpty({ message: '影片名称必填' })
  filmTitle: string;

  @IsString()
  @IsNotEmpty({ message: '影片版权凭证必填' })
  copyrightProof: string;

  @IsString()
  @IsOptional()
  eventRecordNo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: '预计观众至少1人' })
  expectedAudience: number;

  @IsString()
  @IsNotEmpty({ message: '供电条件必填' })
  powerCondition: string;

  @IsNumberString()
  screenSize: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  speakerCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: '至少安排1名安保人员' })
  securityStaffCount: number;

  @IsString()
  @IsNotEmpty({ message: '雨天预案必填' })
  rainPlan: string;

  @IsNumberString()
  @IsOptional()
  deposit?: string;
}

export class AssignOnsiteDto {
  @IsUUID()
  onsiteManagerId: string;
}
