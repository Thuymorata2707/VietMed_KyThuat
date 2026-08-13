import { IsOptional, IsString } from 'class-validator';

export class DeleteWorkTaskDto {
  @IsOptional()
  @IsString()
  reason?: string | null;
}
