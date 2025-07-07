import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, IsNotEmpty, MinLength, MaxLength, Min, Max } from 'class-validator';
import { ReceiptStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateReceiptDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must be a valid number with up to 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(999999.99, { message: 'Amount must not exceed 999,999.99' })
  amount: number;

  @IsNotEmpty()
  @IsDateString({}, { message: 'Date must be a valid ISO date string' })
  date: string;

  @IsOptional()
  @IsEnum(ReceiptStatus, { message: 'Status must be PENDING, APPROVED, or REJECTED' })
  status?: ReceiptStatus = ReceiptStatus.PENDING;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Image URL must not exceed 500 characters' })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'File path must not exceed 500 characters' })
  filePath?: string;

  @IsNotEmpty()
  @IsString()
  houseId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Due day must be between 1 and 31' })
  @Max(31, { message: 'Due day must be between 1 and 31' })
  dueDay?: number; // For automatic due date calculation
}
