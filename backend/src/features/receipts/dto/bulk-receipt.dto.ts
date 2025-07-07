import { IsArray, ValidateNested, IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReceiptDto } from './create-receipt.dto';
import { ReceiptStatus } from '@prisma/client';

export class BulkReceiptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptDto)
  receipts: CreateReceiptDto[];
}

export class BulkUpdateStatusDto {
  @IsArray()
  @IsString({ each: true })
  receiptIds: string[];

  @IsEnum(ReceiptStatus)
  status: ReceiptStatus;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  receiptIds: string[];
}
