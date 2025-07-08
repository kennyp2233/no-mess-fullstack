export interface BudgetComparisonDto {
  year: number;
  houseId: string;
  
  // Presupuestado
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  
  // Ejecutado (real)
  actualIncome: number;
  actualExpense: number;
  actualBalance: number;
  
  // Variaciones
  incomeVariance: number;
  expenseVariance: number;
  balanceVariance: number;
  
  // Porcentajes de ejecución
  incomeExecutionPercentage: number;
  expenseExecutionPercentage: number;
  
  // Alertas
  budgetExceeded: boolean;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: 'EXPENSE_EXCEEDED' | 'INCOME_BELOW_TARGET' | 'BUDGET_VARIANCE';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  amount: number;
  percentage: number;
}

export interface BudgetExecutionReportDto {
  houseId: string;
  year: number;
  monthlyExecution: MonthlyExecutionDto[];
  yearToDateSummary: YearToDateSummaryDto;
  recommendations: string[];
}

export interface MonthlyExecutionDto {
  month: number;
  monthName: string;
  projectedIncome: number;
  actualIncome: number;
  projectedExpense: number;
  actualExpense: number;
  variance: number;
}

export interface YearToDateSummaryDto {
  totalProjectedIncome: number;
  totalActualIncome: number;
  totalProjectedExpense: number;
  totalActualExpense: number;
  overallVariance: number;
  remainingBudget: number;
}
