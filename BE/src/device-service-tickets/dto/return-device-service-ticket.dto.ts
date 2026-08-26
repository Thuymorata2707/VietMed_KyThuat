import { IsDateString, IsOptional, IsString } from 'class-validator';
import { UsedPartsContainerDto } from '../../common/dto/used-part.dto';

export class ReturnDeviceServiceTicketDto extends UsedPartsContainerDto {
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  repairMethod?: string;

  @IsOptional()
  @IsString()
  repairCostItems?: string;

  @IsOptional()
  @IsString()
  resultNote?: string;

  @IsOptional()
  @IsString()
  returnCondition?: string;

  @IsOptional()
  @IsString()
  totalRepairCost?: string;

  @IsOptional()
  @IsString()
  repairCostInWords?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
