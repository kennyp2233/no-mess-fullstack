import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database';
import { CreateReceiptDto, UpdateReceiptDto, QueryReceiptsDto, UpdateReceiptStatusDto } from '../dto';
import { PaginatedResponseDto } from '../../houses/dto';
import { Receipt, ReceiptStatus } from '@prisma/client';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createReceiptDto: CreateReceiptDto, userId: string) {
    const receiptDate = new Date(createReceiptDto.date);
    
    // Check for duplicates (same house, same month/year)
    await this.checkForDuplicates(createReceiptDto.houseId, receiptDate, createReceiptDto.title);
    
    // Verify house exists
    await this.verifyHouseExists(createReceiptDto.houseId);
    
    // Calculate due date if dueDay is provided
    const dueDate = this.calculateDueDate(receiptDate, createReceiptDto.dueDay);
    
    const receipt = await this.prismaService.receipt.create({
      data: {
        ...createReceiptDto,
        userId,
        date: receiptDate,
        // Add calculated fields if needed
        ...(dueDate && { dueDate }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return receipt;
  }

  async findAll(queryDto?: QueryReceiptsDto, user?: any): Promise<PaginatedResponseDto<any>> {
    const { 
      search, 
      houseId, 
      status, 
      startDate, 
      endDate, 
      month, 
      year, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryDto || {};
    
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Filter by house
    if (houseId) {
      where.houseId = houseId;
    } else if (user) {
      // If no specific house is requested but user is authenticated
      // Only show receipts from houses the user has access to
      where.house = {
        users: {
          some: {
            userId: user.id
          }
        }
      };
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Date filtering
    if (startDate || endDate || month || year) {
      where.date = {};
      
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
      
      // Month/Year filtering (overrides startDate/endDate if provided)
      if (month && year) {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        where.date.gte = startOfMonth;
        where.date.lte = endOfMonth;
      } else if (year) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        where.date.gte = startOfYear;
        where.date.lte = endOfYear;
      }
    }

    // Add search filter if provided
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Get total count for pagination
    const total = await this.prismaService.receipt.count({ where });

    // Get receipts with pagination
    const receipts = await this.prismaService.receipt.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return new PaginatedResponseDto(receipts, total, page, limit);
  }

  async findOne(id: string, user?: any) {
    const receipt = await this.prismaService.receipt.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
            users: {
              include: {
                user: {
                  select: {
                    id: true,
                  }
                }
              }
            }
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }

    // If user is provided, check if they have access to this receipt's house
    if (user) {
      const hasAccess = receipt.house.users.some(houseUser => 
        houseUser.user.id === user.id
      );
      
      if (!hasAccess) {
        throw new NotFoundException(`Receipt with ID ${id} not found`); // Same error for security
      }
    }

    return receipt;
  }

  async update(id: string, updateReceiptDto: UpdateReceiptDto, user?: any) {
    // Check if receipt exists and user has access
    const existingReceipt = await this.findOne(id, user);

    // Prepare update data
    const updateData: any = { ...updateReceiptDto };

    // If the date is being updated, we need to check for duplicates
    if (updateReceiptDto.date) {
      const newDate = new Date(updateReceiptDto.date);
      
      // If the house or date is changing, check for duplicates
      if (updateReceiptDto.houseId || updateReceiptDto.date !== existingReceipt.date.toISOString()) {
        await this.checkForDuplicates(
          updateReceiptDto.houseId || existingReceipt.houseId, 
          newDate, 
          updateReceiptDto.title || existingReceipt.title,
          id // Exclude current receipt from duplicate check
        );
      }
      
      updateData.date = newDate;
    }

    // Verify house exists if houseId is being changed
    if (updateReceiptDto.houseId && updateReceiptDto.houseId !== existingReceipt.houseId) {
      await this.verifyHouseExists(updateReceiptDto.houseId);
    }

    const updatedReceipt = await this.prismaService.receipt.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updatedReceipt;
  }

  async updateStatus(id: string, updateStatusDto: UpdateReceiptStatusDto, user?: any) {
    // Check if receipt exists and user has access
    const existingReceipt = await this.findOne(id, user);

    // Verify the user has ADMIN role for the receipt's house if user is provided
    if (user) {
      const userHouse = user.houses.find(h => h.houseId === existingReceipt.houseId);
      if (!userHouse || userHouse.role !== 'ADMIN') {
        throw new NotFoundException(`Receipt with ID ${id} not found`); // Security through obscurity
      }
    }

    const updatedReceipt = await this.prismaService.receipt.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        // Note: statusReason field would need to be added to schema if needed
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updatedReceipt;
  }

  async remove(id: string, user?: any) {
    // Check if receipt exists and user has access
    const existingReceipt = await this.findOne(id, user);
    
    // Verify the user has ADMIN role for the receipt's house if user is provided
    if (user) {
      const userHouse = user.houses.find(h => h.houseId === existingReceipt.houseId);
      if (!userHouse || userHouse.role !== 'ADMIN') {
        throw new NotFoundException(`Receipt with ID ${id} not found`); // Security through obscurity
      }
    }

    const deletedReceipt = await this.prismaService.receipt.delete({
      where: { id },
    });

    return { message: `Receipt "${deletedReceipt.title}" has been deleted successfully` };
  }

  /**
   * Update receipt file path
   */
  async updateFilePath(id: string, filePath: string, user?: any) {
    // Check if receipt exists and user has access
    const existingReceipt = await this.findOne(id, user);

    // Update the file path
    const updatedReceipt = await this.prismaService.receipt.update({
      where: { id },
      data: { filePath },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updatedReceipt;
  }

  // Helper methods
  private async checkForDuplicates(houseId: string, date: Date, title: string, excludeId?: string) {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    const existingReceipt = await this.prismaService.receipt.findFirst({
      where: {
        houseId,
        title: {
          equals: title,
          mode: 'insensitive',
        },
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existingReceipt) {
      throw new ConflictException(
        `A receipt with title "${title}" already exists for this house in ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      );
    }
  }

  private async verifyHouseExists(houseId: string) {
    const house = await this.prismaService.house.findUnique({
      where: { id: houseId },
    });

    if (!house) {
      throw new BadRequestException(`House with ID ${houseId} not found`);
    }

    return house;
  }

  private calculateDueDate(receiptDate: Date, dueDay?: number): Date | null {
    if (!dueDay) return null;

    const dueDate = new Date(receiptDate);
    dueDate.setDate(dueDay);
    
    // If the due day has passed in the current month, set it for next month
    if (dueDate < receiptDate) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    return dueDate;
  }

  // Statistics methods
  async getReceiptStats(houseId?: string, month?: number, year?: number, user?: any) {
    const where: any = {};
    
    if (houseId) {
      where.houseId = houseId;
      
      // If user is provided and a specific house is requested, verify user has access to this house
      if (user) {
        const hasAccess = user.houses.some(h => h.houseId === houseId);
        if (!hasAccess) {
          throw new NotFoundException(`House with ID ${houseId} not found`);
        }
      }
    } else if (user) {
      // If no specific house is requested but user is provided, only show stats for houses the user has access to
      where.house = {
        users: {
          some: {
            userId: user.id
          }
        }
      };
    }

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      where.date = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
      where.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const [total, pending, approved, rejected, totalAmount, avgAmount] = await Promise.all([
      this.prismaService.receipt.count({ where }),
      this.prismaService.receipt.count({ where: { ...where, status: 'PENDING' } }),
      this.prismaService.receipt.count({ where: { ...where, status: 'APPROVED' } }),
      this.prismaService.receipt.count({ where: { ...where, status: 'REJECTED' } }),
      this.prismaService.receipt.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prismaService.receipt.aggregate({
        where,
        _avg: { amount: true },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      totalAmount: totalAmount._sum.amount || 0,
      averageAmount: avgAmount._avg.amount || 0,
      period: month && year ? `${year}-${month.toString().padStart(2, '0')}` : year ? year.toString() : 'all-time',
    };
  }

  async getMonthlyReceiptsByHouse(houseId: string, year: number, user?: any) {
    // Verify user has access to this house if user is provided
    if (user) {
      const hasAccess = user.houses.some(h => h.houseId === houseId);
      if (!hasAccess) {
        throw new NotFoundException(`House with ID ${houseId} not found`);
      }
    }

    // Verify the house exists
    await this.verifyHouseExists(houseId);

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // Get all receipts for this house in the given year
    const receipts = await this.prismaService.receipt.findMany({
      where: {
        houseId,
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        amount: true,
        date: true,
        status: true,
      },
    });

    // Group receipts by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthReceipts = receipts.filter(r => new Date(r.date).getMonth() === i);
      const totalAmount = monthReceipts.reduce((sum, r) => sum + r.amount, 0);
      const avgAmount = monthReceipts.length > 0 ? totalAmount / monthReceipts.length : 0;
      const approvedAmount = monthReceipts.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.amount, 0);
      const rejectedAmount = monthReceipts.filter(r => r.status === 'REJECTED').reduce((sum, r) => sum + r.amount, 0);
      const pendingAmount = monthReceipts.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + r.amount, 0);

      return {
        month: i + 1,
        totalAmount,
        avgAmount,
        approvedAmount,
        rejectedAmount,
        pendingAmount,
        receiptCount: monthReceipts.length,
      };
    });

    return monthlyData;
  }
}
