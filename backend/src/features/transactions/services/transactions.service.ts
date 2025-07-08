import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database';
import { WorkflowService } from '../../../shared/services';
import { CreateTransactionDto, UpdateTransactionDto, QueryTransactionsDto } from '../dto';
import { Transaction, TransactionType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  async create(createTransactionDto: CreateTransactionDto, userId: string) {
    // Verify house exists and user has access
    const house = await this.prismaService.house.findFirst({
      where: {
        id: createTransactionDto.houseId,
        users: {
          some: {
            userId: userId
          }
        }
      }
    });

    if (!house) {
      throw new NotFoundException('House not found or you do not have access');
    }

    // Verify account exists and belongs to the house
    const account = await this.prismaService.account.findFirst({
      where: {
        id: createTransactionDto.accountId,
        houseId: createTransactionDto.houseId
      }
    });

    if (!account) {
      throw new NotFoundException('Account not found or does not belong to this house');
    }

    // If projectId is provided, verify it exists and belongs to the house
    if (createTransactionDto.projectId) {
      const project = await this.prismaService.project.findFirst({
        where: {
          id: createTransactionDto.projectId,
          houseId: createTransactionDto.houseId
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found or does not belong to this house');
      }
    }

    // Use workflow service to create transaction and update balances
    const workflowResult = await this.workflowService.processTransactionWorkflow({
      title: createTransactionDto.title,
      description: createTransactionDto.description,
      amount: createTransactionDto.amount,
      type: createTransactionDto.type,
      category: createTransactionDto.category,
      date: new Date(createTransactionDto.date),
      userId: userId,
      houseId: createTransactionDto.houseId,
      accountId: createTransactionDto.accountId,
      projectId: createTransactionDto.projectId,
    });

    // Get complete transaction data with relations
    const completeTransaction = await this.prismaService.transaction.findUnique({
      where: { id: workflowResult.transaction.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        house: {
          select: {
            id: true,
            name: true,
          }
        },
        account: {
          select: {
            id: true,
            name: true,
          }
        },
        project: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    return {
      ...completeTransaction,
      workflow: {
        accountBalanceUpdated: true,
        houseBalanceUpdated: true,
        newAccountBalance: workflowResult.updatedAccount.balance,
        newHouseBalance: workflowResult.updatedHouse.balance,
      },
    };
  }

  async findAll(queryDto: QueryTransactionsDto, userId: string) {
    const { 
      search, 
      type, 
      category, 
      houseId, 
      accountId, 
      projectId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10 
    } = queryDto;

    const skip = (page - 1) * limit;

    // Build where clause
    let where: any = {
      // Only show transactions from houses the user has access to
      house: {
        users: {
          some: {
            userId: userId
          }
        }
      }
    };

    // Add filters
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (houseId) {
      where.houseId = houseId;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await this.prismaService.transaction.count({ where });

    // Get transactions with pagination
    const transactions = await this.prismaService.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        house: {
          select: {
            id: true,
            name: true,
          }
        },
        account: {
          select: {
            id: true,
            name: true,
          }
        },
        project: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prismaService.transaction.findFirst({
      where: {
        id,
        house: {
          users: {
            some: {
              userId: userId
            }
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        house: {
          select: {
            id: true,
            name: true,
          }
        },
        account: {
          select: {
            id: true,
            name: true,
          }
        },
        project: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async update(id: string, updateTransactionDto: UpdateTransactionDto, userId: string) {
    // Get original transaction
    const originalTransaction = await this.findOne(id, userId);

    // If amount or type is changing, we need to update balances
    const isBalanceAffecting = 
      updateTransactionDto.amount !== undefined || 
      updateTransactionDto.type !== undefined;

    if (isBalanceAffecting) {
      return await this.prismaService.$transaction(async (prisma) => {
        // Reverse the original transaction's effect on balances
        const originalBalanceChange = originalTransaction.type === TransactionType.INCOME 
          ? originalTransaction.amount 
          : -originalTransaction.amount;

        // Update the transaction
        const updatedTransaction = await prisma.transaction.update({
          where: { id },
          data: {
            ...updateTransactionDto,
            date: updateTransactionDto.date ? new Date(updateTransactionDto.date) : undefined,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              }
            },
            house: {
              select: {
                id: true,
                name: true,
              }
            },
            account: {
              select: {
                id: true,
                name: true,
              }
            },
            project: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        });

        // Calculate new balance change
        const newBalanceChange = updatedTransaction.type === TransactionType.INCOME 
          ? updatedTransaction.amount 
          : -updatedTransaction.amount;

        // Calculate the net change
        const netBalanceChange = newBalanceChange - originalBalanceChange;

        // Update account balance
        await prisma.account.update({
          where: { id: originalTransaction.accountId },
          data: {
            balance: {
              increment: netBalanceChange
            }
          }
        });

        // Update house balance
        await prisma.house.update({
          where: { id: originalTransaction.houseId },
          data: {
            balance: {
              increment: netBalanceChange
            }
          }
        });

        return updatedTransaction;
      });
    } else {
      // Simple update without balance changes
      return await this.prismaService.transaction.update({
        where: { id },
        data: {
          ...updateTransactionDto,
          date: updateTransactionDto.date ? new Date(updateTransactionDto.date) : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          },
          house: {
            select: {
              id: true,
              name: true,
            }
          },
          account: {
            select: {
              id: true,
              name: true,
            }
          },
          project: {
            select: {
              id: true,
              title: true,
            }
          }
        }
      });
    }
  }

  async remove(id: string, userId: string) {
    const transaction = await this.findOne(id, userId);

    return await this.prismaService.$transaction(async (prisma) => {
      // Reverse the transaction's effect on balances
      const balanceChange = transaction.type === TransactionType.INCOME 
        ? transaction.amount 
        : -transaction.amount;

      // Delete the transaction
      const deletedTransaction = await prisma.transaction.delete({
        where: { id }
      });

      // Update account balance (reverse the effect)
      await prisma.account.update({
        where: { id: transaction.accountId },
        data: {
          balance: {
            increment: -balanceChange
          }
        }
      });

      // Update house balance (reverse the effect)
      await prisma.house.update({
        where: { id: transaction.houseId },
        data: {
          balance: {
            increment: -balanceChange
          }
        }
      });

      return { message: `Transaction "${deletedTransaction.title}" has been deleted successfully` };
    });
  }

  async getTransactionStatistics(houseId: string, userId: string) {
    // Verify user has access to house
    const house = await this.prismaService.house.findFirst({
      where: {
        id: houseId,
        users: {
          some: {
            userId: userId
          }
        }
      }
    });

    if (!house) {
      throw new NotFoundException('House not found or you do not have access');
    }

    const where = { houseId };

    const [
      totalTransactions,
      totalIncome,
      totalExpenses,
      incomeCount,
      expenseCount
    ] = await Promise.all([
      this.prismaService.transaction.count({ where }),
      this.prismaService.transaction.aggregate({
        where: { ...where, type: TransactionType.INCOME },
        _sum: { amount: true }
      }),
      this.prismaService.transaction.aggregate({
        where: { ...where, type: TransactionType.EXPENSE },
        _sum: { amount: true }
      }),
      this.prismaService.transaction.count({
        where: { ...where, type: TransactionType.INCOME }
      }),
      this.prismaService.transaction.count({
        where: { ...where, type: TransactionType.EXPENSE }
      })
    ]);

    return {
      totalTransactions,
      totalIncome: totalIncome._sum.amount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      netBalance: (totalIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0),
      incomeCount,
      expenseCount
    };
  }
}
