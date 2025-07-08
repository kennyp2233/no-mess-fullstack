import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class AssignUserToHouseDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum(Role, { message: 'Role must be one of: ADMIN, PRESIDENT, TREASURER, SECRETARY, RESIDENT' })
  role: Role;
}
