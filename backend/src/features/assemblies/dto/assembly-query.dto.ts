import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { AssemblyStatus } from '@prisma/client';

export class AssemblyQueryDto {
  @IsOptional()
  @IsString()
  houseId?: string;

  @IsOptional()
  @IsEnum(AssemblyStatus)
  status?: AssemblyStatus;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: string = 'date';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AssemblyStatsDto {
  total: number;
  byStatus: {
    SCHEDULED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  upcoming: number;
  past: number;
  thisMonth: number;
  nextMonth: number;
}
