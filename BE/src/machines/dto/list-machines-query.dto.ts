import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMachinesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MachineStatus)
  status?: MachineStatus;

  @IsOptional()
  @IsEnum(MachineInventoryStatus)
  inventoryStatus?: MachineInventoryStatus;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsString()
  engineerId?: string;
}
