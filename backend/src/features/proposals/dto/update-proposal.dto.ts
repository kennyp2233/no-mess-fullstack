import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProposalType, ProposalStatus } from '@prisma/client';

export class UpdateProposalDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProposalType)
  @IsOptional()
  proposalType?: ProposalType;

  @IsEnum(ProposalStatus)
  @IsOptional()
  status?: ProposalStatus;

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
