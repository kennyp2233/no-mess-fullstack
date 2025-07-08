import { IsNumber, IsOptional, Min, IsString } from 'class-validator';

export class UpdateBudgetDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  projectedIncome?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  projectedExpense?: number;

  @IsOptional()
  isApproved?: boolean;
}
