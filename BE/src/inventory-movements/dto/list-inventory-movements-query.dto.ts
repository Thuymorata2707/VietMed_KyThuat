import { IsEnum, IsOptional } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListInventoryMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;
}
