import { BusinessLineStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMachineComponentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
