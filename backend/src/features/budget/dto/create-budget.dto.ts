import { IsNumber, IsNotEmpty, IsBoolean, IsOptional, Min, IsString } from 'class-validator';

export class CreateBudgetDto {
  @IsNumber()
  @Min(2020)
  year: number;

  @IsNumber()
  @Min(0)
  projectedIncome: number;

  @IsNumber()
  @Min(0)
  projectedExpense: number;

  @IsString()
  @IsNotEmpty()
  houseId: string;

  @IsBoolean()
  @IsOptional()
  isApproved?: boolean = false;
}
