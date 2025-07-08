import { IsOptional, IsString, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { VotingType } from '@prisma/client';

export class UpdateVotingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VotingType)
  @IsOptional()
  type?: VotingType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  requiredQuorum?: number;
}
