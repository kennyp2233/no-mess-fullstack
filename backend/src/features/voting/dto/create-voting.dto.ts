import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max, IsArray, ValidateNested, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { VotingType, ProposalType } from '@prisma/client';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ProposalType)
  proposalType: ProposalType;
}

export class CreateVotingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VotingType)
  type: VotingType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  requiredQuorum?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProposalDto)
  proposals: CreateProposalDto[];

  @IsString()
  @IsNotEmpty()
  assemblyId: string;
}
