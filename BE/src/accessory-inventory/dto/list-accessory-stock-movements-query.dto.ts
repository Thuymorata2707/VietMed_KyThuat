import { AccessoryStockMovementType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAccessoryStockMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  componentAccessoryId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AccessoryStockMovementType)
  type?: AccessoryStockMovementType;
}
