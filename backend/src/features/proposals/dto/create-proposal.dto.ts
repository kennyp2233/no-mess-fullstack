import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ProposalType } from '@prisma/client';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ProposalType)
  proposalType: ProposalType;

  @IsString()
  @IsOptional()
  assemblyId?: string;

  @IsString()
  @IsOptional()
  votingId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}
