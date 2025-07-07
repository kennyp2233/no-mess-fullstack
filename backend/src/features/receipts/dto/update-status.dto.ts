import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReceiptStatus } from '@prisma/client';

export class UpdateReceiptStatusDto {
  @IsEnum(ReceiptStatus, { message: 'Status must be PENDING, APPROVED, or REJECTED' })
  status: ReceiptStatus;

  @IsOptional()
  @IsString()
  reason?: string; // Optional reason for status change
}
