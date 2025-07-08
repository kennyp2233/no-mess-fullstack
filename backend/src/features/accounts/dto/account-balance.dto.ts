export class AccountBalanceDto {
  accountId: string;
  accountName: string;
  currentBalance: number;
  calculatedBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  isBalanced: boolean;
  lastTransactionDate?: Date;
}

export class AccountTransactionHistoryDto {
  accountId: string;
  accountName: string;
  balance: number;
  transactions: TransactionSummaryDto[];
  totalTransactions: number;
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

export class TransactionSummaryDto {
  id: string;
  title: string;
  description?: string;
  amount: number;
  type: string; // 'INCOME' | 'EXPENSE'
  category: string;
  date: Date;
  userId: string;
  userName: string;
  projectId?: string;
  projectTitle?: string;
}
