import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { 
  CreateBudgetDto, 
  UpdateBudgetDto, 
  BudgetComparisonDto, 
  BudgetExecutionReportDto,
  BudgetAlert,
  MonthlyExecutionDto,
  YearToDateSummaryDto
} from '../dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async create(createBudgetDto: CreateBudgetDto) {
    // Check if budget already exists for this year and house
    const existingBudget = await this.prisma.budget.findUnique({
      where: {
        year_houseId: {
          year: createBudgetDto.year,
          houseId: createBudgetDto.houseId,
        },
      },
    });

    if (existingBudget) {
      throw new ConflictException(`Budget for year ${createBudgetDto.year} already exists for this house`);
    }

    // Verify house exists
    const house = await this.prisma.house.findUnique({
      where: { id: createBudgetDto.houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    const budget = await this.prisma.budget.create({
      data: {
        year: createBudgetDto.year,
        projectedIncome: createBudgetDto.projectedIncome,
        projectedExpense: createBudgetDto.projectedExpense,
        houseId: createBudgetDto.houseId,
        isApproved: createBudgetDto.isApproved || false,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
      },
    });

    return budget;
  }

  async findAll(page = 1, limit = 10, houseId?: string, year?: number) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (houseId) where.houseId = houseId;
    if (year) where.year = year;

    const [budgets, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        include: {
          house: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.budget.count({ where }),
    ]);

    return {
      data: budgets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: {
        house: {
          select: { id: true, name: true },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return budget;
  }

  async findByHouseAndYear(houseId: string, year: number) {
    const budget = await this.prisma.budget.findUnique({
      where: {
        year_houseId: { year, houseId },
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
      },
    });

    return budget;
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const updatedBudget = await this.prisma.budget.update({
      where: { id },
      data: updateBudgetDto,
      include: {
        house: {
          select: { id: true, name: true },
        },
      },
    });

    return updatedBudget;
  }

  async remove(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.prisma.budget.delete({
      where: { id },
    });

    return { message: 'Budget deleted successfully' };
  }

  // Compare budget vs actual execution
  async getBudgetComparison(houseId: string, year: number): Promise<BudgetComparisonDto> {
    const budget = await this.findByHouseAndYear(houseId, year);
    
    if (!budget) {
      throw new NotFoundException(`Budget not found for house ${houseId} and year ${year}`);
    }

    // Get actual transactions for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        houseId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate actual amounts
    const actualIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const actualExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const actualBalance = actualIncome - actualExpense;
    const projectedBalance = budget.projectedIncome - budget.projectedExpense;

    // Calculate variances
    const incomeVariance = actualIncome - budget.projectedIncome;
    const expenseVariance = actualExpense - budget.projectedExpense;
    const balanceVariance = actualBalance - projectedBalance;

    // Calculate execution percentages
    const incomeExecutionPercentage = budget.projectedIncome > 0 
      ? (actualIncome / budget.projectedIncome) * 100 
      : 0;
    const expenseExecutionPercentage = budget.projectedExpense > 0 
      ? (actualExpense / budget.projectedExpense) * 100 
      : 0;

    // Generate alerts
    const alerts = this.generateBudgetAlerts(
      budget.projectedExpense,
      actualExpense,
      budget.projectedIncome,
      actualIncome,
      expenseExecutionPercentage,
      incomeExecutionPercentage
    );

    return {
      year,
      houseId,
      projectedIncome: budget.projectedIncome,
      projectedExpense: budget.projectedExpense,
      projectedBalance,
      actualIncome,
      actualExpense,
      actualBalance,
      incomeVariance,
      expenseVariance,
      balanceVariance,
      incomeExecutionPercentage,
      expenseExecutionPercentage,
      budgetExceeded: expenseExecutionPercentage > 100,
      alerts,
    };
  }

  // Generate budget execution report
  async getBudgetExecutionReport(houseId: string, year: number): Promise<BudgetExecutionReportDto> {
    const budget = await this.findByHouseAndYear(houseId, year);
    
    if (!budget) {
      throw new NotFoundException(`Budget not found for house ${houseId} and year ${year}`);
    }

    // Get monthly execution data
    const monthlyExecution: MonthlyExecutionDto[] = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let totalActualIncome = 0;
    let totalActualExpense = 0;

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);

      const monthlyTransactions = await this.prisma.transaction.findMany({
        where: {
          houseId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const monthlyIncome = monthlyTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthlyExpense = monthlyTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      totalActualIncome += monthlyIncome;
      totalActualExpense += monthlyExpense;

      const projectedMonthlyIncome = budget.projectedIncome / 12;
      const projectedMonthlyExpense = budget.projectedExpense / 12;
      const variance = (monthlyIncome - monthlyExpense) - (projectedMonthlyIncome - projectedMonthlyExpense);

      monthlyExecution.push({
        month: month + 1,
        monthName: monthNames[month],
        projectedIncome: projectedMonthlyIncome,
        actualIncome: monthlyIncome,
        projectedExpense: projectedMonthlyExpense,
        actualExpense: monthlyExpense,
        variance,
      });
    }

    // Year-to-date summary
    const yearToDateSummary: YearToDateSummaryDto = {
      totalProjectedIncome: budget.projectedIncome,
      totalActualIncome,
      totalProjectedExpense: budget.projectedExpense,
      totalActualExpense,
      overallVariance: (totalActualIncome - totalActualExpense) - (budget.projectedIncome - budget.projectedExpense),
      remainingBudget: budget.projectedExpense - totalActualExpense,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      budget.projectedIncome,
      totalActualIncome,
      budget.projectedExpense,
      totalActualExpense,
      yearToDateSummary.remainingBudget
    );

    return {
      houseId,
      year,
      monthlyExecution,
      yearToDateSummary,
      recommendations,
    };
  }

  private generateBudgetAlerts(
    projectedExpense: number,
    actualExpense: number,
    projectedIncome: number,
    actualIncome: number,
    expenseExecutionPercentage: number,
    incomeExecutionPercentage: number
  ): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    // Expense exceeded alert
    if (expenseExecutionPercentage > 100) {
      const excessAmount = actualExpense - projectedExpense;
      const excessPercentage = expenseExecutionPercentage - 100;
      
      alerts.push({
        type: 'EXPENSE_EXCEEDED',
        message: `Expenses have exceeded budget by ${excessPercentage.toFixed(1)}%`,
        severity: excessPercentage > 20 ? 'HIGH' : excessPercentage > 10 ? 'MEDIUM' : 'LOW',
        amount: excessAmount,
        percentage: excessPercentage,
      });
    }

    // Income below target alert
    if (incomeExecutionPercentage < 90) {
      const shortfallAmount = projectedIncome - actualIncome;
      const shortfallPercentage = 100 - incomeExecutionPercentage;
      
      alerts.push({
        type: 'INCOME_BELOW_TARGET',
        message: `Income is ${shortfallPercentage.toFixed(1)}% below target`,
        severity: shortfallPercentage > 20 ? 'HIGH' : shortfallPercentage > 10 ? 'MEDIUM' : 'LOW',
        amount: shortfallAmount,
        percentage: shortfallPercentage,
      });
    }

    // Budget variance alert
    const totalVariance = Math.abs((actualIncome - actualExpense) - (projectedIncome - projectedExpense));
    const variancePercentage = projectedIncome > 0 ? (totalVariance / projectedIncome) * 100 : 0;
    
    if (variancePercentage > 15) {
      alerts.push({
        type: 'BUDGET_VARIANCE',
        message: `Budget variance is ${variancePercentage.toFixed(1)}%`,
        severity: variancePercentage > 30 ? 'HIGH' : variancePercentage > 20 ? 'MEDIUM' : 'LOW',
        amount: totalVariance,
        percentage: variancePercentage,
      });
    }

    return alerts;
  }

  private generateRecommendations(
    projectedIncome: number,
    actualIncome: number,
    projectedExpense: number,
    actualExpense: number,
    remainingBudget: number
  ): string[] {
    const recommendations: string[] = [];

    // Income recommendations
    if (actualIncome < projectedIncome * 0.9) {
      recommendations.push('Consider reviewing income sources and collection strategies');
    }

    // Expense recommendations
    if (actualExpense > projectedExpense * 1.1) {
      recommendations.push('Review and control expenses to avoid budget overrun');
    }

    // Budget balance recommendations
    if (remainingBudget < 0) {
      recommendations.push('Implement immediate cost reduction measures');
    } else if (remainingBudget < projectedExpense * 0.1) {
      recommendations.push('Monitor spending closely for the remainder of the year');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Budget execution is on track. Continue monitoring monthly performance');
    }

    return recommendations;
  }
}
