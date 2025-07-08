import { IsString, IsOptional, MinLength, MaxLength, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateHouseDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Address must not exceed 200 characters' })
  address?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Balance must be a valid number' })
  balance?: number;
}
