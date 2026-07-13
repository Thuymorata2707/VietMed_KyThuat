import { TaskChecklistStatus, UsedPartStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SyncWorkLogDto {
  @IsOptional()
  @IsDateString()
  stepTime?: string | null;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class SyncUsedPartDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsNumber()
  unitCost?: number | null;

  @IsOptional()
  @IsEnum(UsedPartStatus)
  status?: UsedPartStatus;

  @IsOptional()
  @IsString()
  inventoryItemId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  usedAt?: string | null;
}

export class SyncTaskChecklistItemDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsEnum(TaskChecklistStatus)
  status?: TaskChecklistStatus;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class SyncWorkOperationsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncWorkLogDto)
  workLogs?: SyncWorkLogDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUsedPartDto)
  usedParts?: SyncUsedPartDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncTaskChecklistItemDto)
  checklistItems?: SyncTaskChecklistItemDto[];
}
