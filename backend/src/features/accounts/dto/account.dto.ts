import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsString()
  houseId: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  balance?: number;
}

export class AccountResponseDto {
  id: string;
  name: string;
  description?: string;
  balance: number;
  houseId: string;
  createdAt: Date;
  updatedAt: Date;
}
