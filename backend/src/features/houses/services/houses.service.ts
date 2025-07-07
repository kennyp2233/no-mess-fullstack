import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database';
import { CreateHouseDto, UpdateHouseDto, QueryHousesDto, PaginatedResponseDto } from '../dto';
import { House } from '@prisma/client';

@Injectable()
export class HousesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createHouseDto: CreateHouseDto) {
    const house = await this.prismaService.house.create({
      data: createHouseDto,
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            receipts: true,
          },
        },
      },
    });
    return house;
  }

  async findAll(queryDto?: QueryHousesDto, user?: any): Promise<PaginatedResponseDto<any>> {
    const { search, page = 1, limit = 10 } = queryDto || {};
    const skip = (page - 1) * limit;

    // Build where clause for search and user filter
    let where: any = {};
    
    // Add text search if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    
    // Filter houses by user if authenticated user is provided
    if (user) {
      // If user is provided, only return houses the user has access to
      where = {
        ...where,
        users: {
          some: {
            userId: user.id
          }
        }
      };
    }

    // Get total count for pagination
    const total = await this.prismaService.house.count({ where });

    // Get houses with pagination
    const houses = await this.prismaService.house.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            receipts: true,
          },
        },
      },
    });

    return new PaginatedResponseDto(houses, total, page, limit);
  }

  async findOne(id: string, user?: any) {
    const house = await this.prismaService.house.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        receipts: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!house) {
      throw new NotFoundException(`House with ID ${id} not found`);
    }

    // If user is provided, verify they have access to this house
    if (user) {
      const hasAccess = house.users.some(houseUser => houseUser.user.id === user.id);
      if (!hasAccess) {
        throw new NotFoundException(`House with ID ${id} not found`); // Same error for security
      }
    }

    return house;
  }

  async update(id: string, updateHouseDto: UpdateHouseDto) {
    // Check if house exists
    await this.findOne(id);

    const updatedHouse = await this.prismaService.house.update({
      where: { id },
      data: updateHouseDto,
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            receipts: true,
          },
        },
      },
    });

    return updatedHouse;
  }

  async remove(id: string) {
    // Check if house exists
    await this.findOne(id);

    const deletedHouse = await this.prismaService.house.delete({
      where: { id },
    });

    return { message: `House "${deletedHouse.name}" has been deleted successfully` };
  }
}
