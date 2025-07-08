import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database';
import { CreateHouseDto, UpdateHouseDto, QueryHousesDto, PaginatedResponseDto, AssignUserToHouseDto } from '../dto';
import { House, Role } from '@prisma/client';

@Injectable()
export class HousesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createHouseDto: CreateHouseDto) {
    const house = await this.prismaService.house.create({
      data: {
        ...createHouseDto,
        balance: createHouseDto.balance || 0,
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
            projects: true,
            assemblies: true,
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
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
            projects: true,
            assemblies: true,
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
                phone: true,
              },
            },
          },
        },
        transactions: {
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
          take: 10, // Últimas 10 transacciones
        },
        projects: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Últimos 5 proyectos
        },
        _count: {
          select: {
            transactions: true,
            projects: true,
            assemblies: true,
          },
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
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
            projects: true,
            assemblies: true,
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

  // New methods for the updated schema

  async getHouseBalance(id: string): Promise<{ balance: number; houseId: string; houseName: string }> {
    const house = await this.prismaService.house.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        balance: true,
      },
    });

    if (!house) {
      throw new NotFoundException(`House with ID ${id} not found`);
    }

    return {
      balance: house.balance,
      houseId: house.id,
      houseName: house.name,
    };
  }

  async assignUserToHouse(houseId: string, assignUserDto: AssignUserToHouseDto): Promise<any> {
    // Verify house exists
    const house = await this.prismaService.house.findUnique({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException(`House with ID ${houseId} not found`);
    }

    // Verify user exists
    const user = await this.prismaService.user.findUnique({
      where: { id: assignUserDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${assignUserDto.userId} not found`);
    }

    // Check if relationship already exists
    const existingRelation = await this.prismaService.houseUser.findUnique({
      where: {
        userId_houseId: {
          userId: assignUserDto.userId,
          houseId: houseId,
        },
      },
    });

    if (existingRelation) {
      throw new ConflictException('User is already assigned to this house');
    }

    // Create the relationship
    const houseUser = await this.prismaService.houseUser.create({
      data: {
        userId: assignUserDto.userId,
        houseId: houseId,
        role: assignUserDto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
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

    return houseUser;
  }

  async removeUserFromHouse(houseId: string, userId: string): Promise<{ message: string }> {
    // Verify the relationship exists
    const houseUser = await this.prismaService.houseUser.findUnique({
      where: {
        userId_houseId: {
          userId: userId,
          houseId: houseId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        house: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!houseUser) {
      throw new NotFoundException('User is not assigned to this house');
    }

    // Delete the relationship
    await this.prismaService.houseUser.delete({
      where: {
        userId_houseId: {
          userId: userId,
          houseId: houseId,
        },
      },
    });

    return {
      message: `User "${houseUser.user.name}" has been removed from house "${houseUser.house.name}"`,
    };
  }

  async updateUserRole(houseId: string, userId: string, newRole: Role): Promise<any> {
    // Verify the relationship exists
    const houseUser = await this.prismaService.houseUser.findUnique({
      where: {
        userId_houseId: {
          userId: userId,
          houseId: houseId,
        },
      },
    });

    if (!houseUser) {
      throw new NotFoundException('User is not assigned to this house');
    }

    // Update the role
    const updatedHouseUser = await this.prismaService.houseUser.update({
      where: {
        userId_houseId: {
          userId: userId,
          houseId: houseId,
        },
      },
      data: {
        role: newRole,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
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

    return updatedHouseUser;
  }
}
