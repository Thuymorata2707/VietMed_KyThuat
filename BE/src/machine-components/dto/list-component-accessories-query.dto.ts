import { BusinessLineStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListComponentAccessoriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
