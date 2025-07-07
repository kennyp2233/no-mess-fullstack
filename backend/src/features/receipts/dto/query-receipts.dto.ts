import { IsOptional, IsString, IsInt, Min, Max, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptStatus } from '@prisma/client';

export class QueryReceiptsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  houseId?: string;

  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number; // Filter by month (1-12)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2030)
  year?: number; // Filter by year

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: 'date' | 'amount' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
