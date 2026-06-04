import { IsNotEmpty, IsString } from 'class-validator';

export class AssignMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  engineerId!: string;
}
