import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ApplicationSupportChannel,
  ApplicationSupportIssueCategory,
  ApplicationSupportWorkType,
  ApplicationSupportStatus,
} from '@prisma/client';

export class SaveApplicationSupportCaseDto {
  @IsOptional()
  @IsString()
  engineerId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsString()
  supportedAt!: string;

  @IsOptional()
  @IsEnum(ApplicationSupportChannel)
  channel?: ApplicationSupportChannel;

  @IsOptional()
  @IsEnum(ApplicationSupportWorkType)
  workType?: ApplicationSupportWorkType;

  @IsOptional()
  @IsEnum(ApplicationSupportIssueCategory)
  issueCategory?: ApplicationSupportIssueCategory;

  @IsOptional()
  @IsEnum(ApplicationSupportStatus)
  status?: ApplicationSupportStatus;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  appModule?: string;

  @IsOptional()
  @IsString()
  machineText?: string;

  @IsOptional()
  @IsString()
  impactLevel?: string;

  @IsOptional()
  @IsString()
  reagentName?: string;

  @IsOptional()
  @IsString()
  reagentLot?: string;

  @IsOptional()
  @IsString()
  reagentExpiry?: string;

  @IsOptional()
  @IsString()
  assayName?: string;

  @IsOptional()
  @IsString()
  qcResult?: string;

  @IsOptional()
  @IsString()
  calibrationResult?: string;

  @IsOptional()
  @IsString()
  lisHisStatus?: string;

  @IsString()
  title!: string;

  @IsString()
  issueDescription!: string;

  @IsString()
  resolution!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  pending?: string;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  followUpNeeded?: boolean;

  @IsOptional()
  @IsString()
  followUpDate?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  knowledgeCandidate?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
