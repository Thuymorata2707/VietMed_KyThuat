import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string | null;
  roleId?: string;
  regionId?: string;
  status?: UserStatus;
}
