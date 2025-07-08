import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { WorkflowService, BusinessRulesService } from '../../../shared/services';
import { AssemblyStatus } from '@prisma/client';
import {
  CreateAssemblyDto,
  UpdateAssemblyDto,
  UpdateAssemblyStatusDto,
  AssemblyResponseDto,
  AssemblyQueryDto,
  AssemblyStatsDto,
} from '../dto';

@Injectable()
export class AssembliesService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
    private businessRules: BusinessRulesService,
  ) {}

  async create(createAssemblyDto: CreateAssemblyDto, proposalIds?: string[]): Promise<AssemblyResponseDto> {
    // Verificar que la casa existe
    const house = await this.prisma.house.findUnique({
      where: { id: createAssemblyDto.houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    const assemblyDate = new Date(createAssemblyDto.date);

    // Validar que la fecha no sea en el pasado
    if (assemblyDate < new Date()) {
      throw new BadRequestException('Assembly date cannot be in the past');
    }

    // Usar reglas de negocio para validar conflictos de programación
    const schedulingValidation = await this.businessRules.validateAssemblyScheduling(assemblyDate);
    if (!schedulingValidation.isValid) {
      throw new BadRequestException('Assembly conflicts with existing assemblies on the same date');
    }

    // Usar workflow para crear asamblea con votaciones automáticas
    const workflowResult = await this.workflowService.createAssemblyWorkflow({
      title: createAssemblyDto.title,
      description: createAssemblyDto.description,
      date: assemblyDate,
      location: createAssemblyDto.location,
      houseId: createAssemblyDto.houseId,
      proposalIds: proposalIds,
    });

    // Retornar con información del workflow
    return {
      ...workflowResult.assembly,
      house: { id: house.id, name: house.name },
      _count: {
        votings: workflowResult.votings.length,
        proposals: proposalIds?.length || 0,
        minutes: 0,
      },
      workflow: {
        votingsCreated: workflowResult.votings.length,
        proposalsLinked: proposalIds?.length || 0,
      },
    };
  }

  async findAll(query: AssemblyQueryDto = {}) {
    const {
      houseId,
      status,
      fromDate,
      toDate,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'date',
      sortOrder = 'desc',
    } = query;

    // Construir filtros
    const where: any = {};

    if (houseId) {
      where.houseId = houseId;
    }

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validar campo de ordenamiento
    const allowedSortFields = ['date', 'title', 'status', 'createdAt'];
    const orderBy = allowedSortFields.includes(sortBy) 
      ? { [sortBy]: sortOrder as 'asc' | 'desc' } 
      : { date: 'desc' as 'desc' };

    const [assemblies, total] = await Promise.all([
      this.prisma.assembly.findMany({
        where,
        include: {
          house: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              votings: true,
              proposals: true,
              minutes: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.assembly.count({ where }),
    ]);

    return {
      data: assemblies,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findOne(id: string): Promise<AssemblyResponseDto> {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id },
      include: {
        house: {
          select: { id: true, name: true, address: true },
        },
        votings: {
          include: {
            _count: {
              select: { votes: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        proposals: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        minutes: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            votings: true,
            proposals: true,
            minutes: true,
          },
        },
      },
    });

    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }

    return assembly;
  }

  async update(id: string, updateAssemblyDto: UpdateAssemblyDto): Promise<AssemblyResponseDto> {
    const existingAssembly = await this.prisma.assembly.findUnique({
      where: { id },
    });

    if (!existingAssembly) {
      throw new NotFoundException('Assembly not found');
    }

    // Validar transición de estado si se está actualizando
    if (updateAssemblyDto.status) {
      this.validateStatusTransition(existingAssembly.status, updateAssemblyDto.status);
    }

    // Si se está actualizando la fecha
    if (updateAssemblyDto.date) {
      const newDate = new Date(updateAssemblyDto.date);
      
      // Solo permitir cambios de fecha si la asamblea no ha empezado
      if (existingAssembly.status === 'IN_PROGRESS' || existingAssembly.status === 'COMPLETED') {
        throw new BadRequestException('Cannot change date of assembly that is in progress or completed');
      }

      // Validar que la nueva fecha no sea en el pasado
      if (newDate < new Date()) {
        throw new BadRequestException('Assembly date cannot be in the past');
      }

      // Verificar conflictos de fechas
      await this.checkDateConflicts(
        existingAssembly.houseId,
        newDate,
        updateAssemblyDto.location || existingAssembly.location,
        id // Excluir la asamblea actual del check
      );
    }

    const updateData: any = { ...updateAssemblyDto };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const assembly = await this.prisma.assembly.update({
      where: { id },
      data: updateData,
      include: {
        house: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            votings: true,
            proposals: true,
            minutes: true,
          },
        },
      },
    });

    return assembly;
  }

  async updateStatus(id: string, updateStatusDto: UpdateAssemblyStatusDto): Promise<AssemblyResponseDto> {
    const existingAssembly = await this.prisma.assembly.findUnique({
      where: { id },
    });

    if (!existingAssembly) {
      throw new NotFoundException('Assembly not found');
    }

    // Usar reglas de negocio para validar transición
    if (!this.businessRules.canTransitionAssemblyStatus(existingAssembly.status, updateStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${existingAssembly.status} to ${updateStatusDto.status}`
      );
    }

    // Usar workflows para casos especiales
    if (updateStatusDto.status === AssemblyStatus.IN_PROGRESS) {
      const assembly = await this.workflowService.startAssembly(id);
      return {
        ...assembly,
        house: { id: '', name: '' }, // Will be populated by the service
        _count: { votings: 0, proposals: 0, minutes: 0 },
      };
    }

    if (updateStatusDto.status === AssemblyStatus.COMPLETED) {
      const result = await this.workflowService.completeAssembly(id);
      return {
        ...result.assembly,
        house: { id: '', name: '' }, // Will be populated by the service
        _count: { votings: result.processedVotings.length, proposals: 0, minutes: 0 },
        workflow: {
          votingsProcessed: result.processedVotings.length,
          proposalsUpdated: result.processedVotings.reduce((sum, v) => sum + v.updatedProposals.length, 0),
          projectsUpdated: result.processedVotings.reduce((sum, v) => sum + v.updatedProjects.length, 0),
        },
      };
    }

    // Transición simple sin workflow especial
    const assembly = await this.prisma.assembly.update({
      where: { id },
      data: { status: updateStatusDto.status },
      include: {
        house: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            votings: true,
            proposals: true,
            minutes: true,
          },
        },
      },
    });

    return assembly;
  }

  async remove(id: string): Promise<void> {
    const existingAssembly = await this.prisma.assembly.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            votings: true,
            proposals: true,
            minutes: true,
          },
        },
      },
    });

    if (!existingAssembly) {
      throw new NotFoundException('Assembly not found');
    }

    // No permitir eliminar asambleas con contenido asociado
    if (existingAssembly._count.votings > 0 || 
        existingAssembly._count.proposals > 0 || 
        existingAssembly._count.minutes > 0) {
      throw new BadRequestException(
        'Cannot delete assembly with associated votings, proposals, or minutes. Cancel the assembly instead.'
      );
    }

    // Solo permitir eliminar asambleas programadas
    if (existingAssembly.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Can only delete assemblies in SCHEDULED status. Cancel the assembly instead.'
      );
    }

    await this.prisma.assembly.delete({
      where: { id },
    });
  }

  async getAssembliesByHouse(houseId: string, status?: AssemblyStatus) {
    const house = await this.prisma.house.findUnique({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    const where: any = { houseId };
    if (status) {
      where.status = status;
    }

    return this.prisma.assembly.findMany({
      where,
      include: {
        house: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            votings: true,
            proposals: true,
            minutes: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getUpcomingAssemblies(houseId?: string) {
    const where: any = {
      date: { gte: new Date() },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    };

    if (houseId) {
      where.houseId = houseId;
    }

    return this.prisma.assembly.findMany({
      where,
      include: {
        house: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            votings: true,
            proposals: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getAssemblyStats(houseId?: string): Promise<AssemblyStatsDto> {
    const where = houseId ? { houseId } : {};
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [assemblies, statusCounts] = await Promise.all([
      this.prisma.assembly.findMany({
        where,
        select: { date: true, status: true },
      }),
      this.prisma.assembly.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    const total = assemblies.length;
    const upcoming = assemblies.filter(a => a.date >= now && 
      (a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS')).length;
    const past = assemblies.filter(a => a.date < now).length;
    const thisMonth = assemblies.filter(a => 
      a.date >= startOfMonth && a.date < startOfNextMonth).length;
    const nextMonth = assemblies.filter(a => 
      a.date >= startOfNextMonth && a.date < new Date(now.getFullYear(), now.getMonth() + 2, 1)).length;

    const byStatus = {
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      byStatus[status] = _count;
    });

    return {
      total,
      byStatus,
      upcoming,
      past,
      thisMonth,
      nextMonth,
    };
  }

  async getAssemblyVotings(assemblyId: string) {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: assemblyId },
      include: {
        votings: {
          include: {
            proposals: true,
            votes: {
              include: { user: { select: { id: true, name: true, email: true } } }
            },
            _count: { select: { votes: true, proposals: true } }
          }
        }
      }
    });

    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }

    return assembly.votings;
  }

  async getAssemblyProposals(assemblyId: string) {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: assemblyId },
      include: {
        proposals: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            voting: true,
            project: true
          }
        }
      }
    });

    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }

    return assembly.proposals;
  }

  private async checkDateConflicts(
    houseId: string,
    date: Date,
    location?: string,
    excludeAssemblyId?: string
  ): Promise<void> {
    // Buscar asambleas en la misma casa en un rango de +/- 2 horas
    const twoHoursEarlier = new Date(date.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursLater = new Date(date.getTime() + 2 * 60 * 60 * 1000);

    const where: any = {
      houseId,
      date: {
        gte: twoHoursEarlier,
        lte: twoHoursLater,
      },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    };

    if (excludeAssemblyId) {
      where.id = { not: excludeAssemblyId };
    }

    const conflictingAssemblies = await this.prisma.assembly.findMany({
      where,
      select: { id: true, title: true, date: true, location: true },
    });

    if (conflictingAssemblies.length > 0) {
      const conflict = conflictingAssemblies[0];
      throw new BadRequestException(
        `Assembly conflicts with "${conflict.title}" scheduled for ${conflict.date.toLocaleString()}`
      );
    }

    // Si se especifica ubicación, verificar conflictos de ubicación en cualquier casa
    if (location) {
      const locationConflicts = await this.prisma.assembly.findMany({
        where: {
          location: { equals: location, mode: 'insensitive' },
          date: {
            gte: twoHoursEarlier,
            lte: twoHoursLater,
          },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          id: excludeAssemblyId ? { not: excludeAssemblyId } : undefined,
        },
        select: { id: true, title: true, date: true, house: { select: { name: true } } },
      });

      if (locationConflicts.length > 0) {
        const conflict = locationConflicts[0];
        throw new BadRequestException(
          `Location "${location}" is already booked by "${conflict.title}" (${conflict.house.name}) at ${conflict.date.toLocaleString()}`
        );
      }
    }
  }

  private validateStatusTransition(currentStatus: AssemblyStatus, newStatus: AssemblyStatus): void {
    const validTransitions: Record<AssemblyStatus, AssemblyStatus[]> = {
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // Las asambleas completadas no pueden cambiar de estado
      CANCELLED: [], // Las asambleas canceladas no pueden cambiar de estado
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
