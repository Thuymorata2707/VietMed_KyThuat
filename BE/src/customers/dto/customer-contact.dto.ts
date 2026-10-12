import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CustomerContactDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  position?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
