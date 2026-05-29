import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  email!: string;
  password!: string;
  fullName!: string;
  phone?: string;
  roleId!: string;
  regionId!: string;
  status?: UserStatus;
}
