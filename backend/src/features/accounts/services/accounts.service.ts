import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
  AccountBalanceDto,
  AccountTransactionHistoryDto,
  TransactionSummaryDto,
} from '../dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    // Verificar que la casa existe
    const house = await this.prisma.house.findUnique({
      where: { id: createAccountDto.houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    const account = await this.prisma.account.create({
      data: {
        name: createAccountDto.name,
        description: createAccountDto.description,
        balance: createAccountDto.balance || 0,
        houseId: createAccountDto.houseId,
      },
    });

    return account;
  }

  async findAll(houseId?: string): Promise<AccountResponseDto[]> {
    const where = houseId ? { houseId } : {};
    
    const accounts = await this.prisma.account.findMany({
      where,
      include: {
        house: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts;
  }

  async findOne(id: string): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        house: {
          select: { name: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto): Promise<AccountResponseDto> {
    const existingAccount = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      throw new NotFoundException('Account not found');
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: updateAccountDto,
    });

    return account;
  }

  async remove(id: string): Promise<void> {
    const existingAccount = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      throw new NotFoundException('Account not found');
    }

    // Verificar que no tenga transacciones asociadas
    const transactionCount = await this.prisma.transaction.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with associated transactions'
      );
    }

    await this.prisma.account.delete({
      where: { id },
    });
  }

  async getAccountBalance(accountId: string): Promise<AccountBalanceDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Calcular balance desde transacciones
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId },
      select: {
        amount: true,
        type: true,
        date: true,
      },
      orderBy: { date: 'desc' },
    });

    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const calculatedBalance = totalIncome - totalExpense;
    const isBalanced = Math.abs(account.balance - calculatedBalance) < 0.01; // Tolerancia para decimales

    const lastTransactionDate = transactions.length > 0 ? transactions[0].date : undefined;

    return {
      accountId: account.id,
      accountName: account.name,
      currentBalance: account.balance,
      calculatedBalance,
      totalIncome,
      totalExpense,
      transactionCount: transactions.length,
      isBalanced,
      lastTransactionDate,
    };
  }

  async getTransactionHistory(
    accountId: string,
    options?: {
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<AccountTransactionHistoryDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const { limit = 50, offset = 0, fromDate, toDate } = options || {};

    // Construir filtros de fecha
    const dateFilter: any = {};
    if (fromDate || toDate) {
      dateFilter.date = {};
      if (fromDate) dateFilter.date.gte = fromDate;
      if (toDate) dateFilter.date.lte = toDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId,
        ...dateFilter,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });

    const totalTransactions = await this.prisma.transaction.count({
      where: {
        accountId,
        ...dateFilter,
      },
    });

    const transactionSummaries: TransactionSummaryDto[] = transactions.map(transaction => ({
      id: transaction.id,
      title: transaction.title,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      userId: transaction.user.id,
      userName: transaction.user.name,
      projectId: transaction.project?.id,
      projectTitle: transaction.project?.title,
    }));

    return {
      accountId: account.id,
      accountName: account.name,
      balance: account.balance,
      transactions: transactionSummaries,
      totalTransactions,
      dateRange: {
        from: fromDate,
        to: toDate,
      },
    };
  }

  async recalculateBalance(accountId: string): Promise<AccountBalanceDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Calcular balance real desde transacciones
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId },
      select: {
        amount: true,
        type: true,
      },
    });

    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const calculatedBalance = totalIncome - totalExpense;

    // Actualizar el balance en la base de datos
    await this.prisma.account.update({
      where: { id: accountId },
      data: { balance: calculatedBalance },
    });

    // Retornar información del balance actualizado
    return this.getAccountBalance(accountId);
  }

  async getAccountsByHouse(houseId: string): Promise<AccountResponseDto[]> {
    const house = await this.prisma.house.findUnique({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    return this.findAll(houseId);
  }
}
