import { IsNotEmpty, IsString } from 'class-validator';

export class AssignRepairDto {
  @IsString()
  @IsNotEmpty()
  engineerId!: string;
}
