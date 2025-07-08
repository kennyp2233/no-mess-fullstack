import { IsOptional, IsString, IsEnum } from 'class-validator';
import { VotingType } from '@prisma/client';

export class VotingQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(VotingType)
  type?: VotingType;

  @IsOptional()
  @IsString()
  assemblyId?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'upcoming' | 'closed'; // Estados calculados

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 10;
}
