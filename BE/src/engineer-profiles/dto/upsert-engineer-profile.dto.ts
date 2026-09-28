import { ExpertiseGroup } from '@prisma/client';
import {
  IsArray,
  ArrayUnique,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertEngineerProfileDto {
  @IsOptional()
  @IsString()
  employeeCode?: string | null;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  position?: string | null;

  @IsOptional()
  @IsString()
  department?: string | null;

  @IsOptional()
  @IsDateString()
  workStartDate?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  @IsEnum(ExpertiseGroup)
  expertiseGroup?: ExpertiseGroup | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ExpertiseGroup, { each: true })
  expertiseGroups?: ExpertiseGroup[];

  @IsOptional()
  @IsString()
  certificateNo?: string | null;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
