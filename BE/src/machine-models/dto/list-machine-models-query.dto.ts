import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMachineModelsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;
}
