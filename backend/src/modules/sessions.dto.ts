import {
  IsInt, IsNumber, IsOptional, IsString, Min, IsArray, IsDateString, IsBoolean,
} from 'class-validator';

export class CreateSessionDto {
  @IsString() title: string;
  @IsString() organizationId: string;
  @IsString() venueId: string;
  @IsDateString() screeningDate: string;
  @IsInt() @Min(1) expectedAudience: number;
  @IsString() copyrightProof: string;
  @IsString() powerCondition: string;
  @IsString() screenSize: string;
  @IsInt() @Min(0) speakerCount: number;
  @IsInt() @Min(0) securityStaffCount: number;
  @IsString() rainPlan: string;
}

export class ReviewDto {
  @IsBoolean() approved: boolean;
  @IsOptional() @IsString() copyrightAuthNo?: string;
  @IsOptional() @IsString() filingNo?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() fieldLeaderId?: string;
}

export class PrepareDto {
  @IsArray() equipmentIds: string[];
}

export class ScanDto {
  @IsString() qrCode: string;
}

export class InspectionDto {
  @IsString() setupPhoto: string;
  @IsString() testPlayScreenshot: string;
  @IsNumber() @Min(0) noiseDb: number;
  @IsString() isolationDesc: string;
  @IsString() fireLaneDesc: string;
  @IsOptional() @IsString() remark?: string;
}

export class FinishDto {
  @IsInt() @Min(0) actualAudience: number;
}

export class ReturnItemDto {
  @IsString() equipmentId: string;
  @IsString() state: 'RETURNED' | 'DAMAGED' | 'LOST';
  @IsOptional() @IsNumber() compensation?: number;
  @IsOptional() @IsString() note?: string;
}

export class ReturnDto {
  @IsArray() items: ReturnItemDto[];
}

export class SettleDto {
  @IsNumber() @Min(0) subsidyAmount: number;
  @IsBoolean() copyrightWriteoff: boolean;
  @IsOptional() @IsString() remark?: string;
}
