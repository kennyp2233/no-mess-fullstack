import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class UpdateProposalStatusDto {
  @IsEnum(ProposalStatus)
  @IsNotEmpty()
  status: ProposalStatus;
}
