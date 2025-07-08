import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { VoteOption } from '@prisma/client';

export class CastVoteDto {
  @IsEnum(VoteOption)
  option: VoteOption;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsNotEmpty()
  votingId: string;
}
