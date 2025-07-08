import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { WorkflowService, BusinessRulesService } from '../../../shared/services';
import { ProjectStatus } from '@prisma/client';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ProjectQueryDto,
  ProjectStatsDto,
} from '../dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
    private businessRules: BusinessRulesService,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    // Verificar que la casa existe
    const house = await this.prisma.house.findUnique({
      where: { id: createProjectDto.houseId },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    // Validar fechas
    if (createProjectDto.startDate && createProjectDto.endDate) {
      const startDate = new Date(createProjectDto.startDate);
      const endDate = new Date(createProjectDto.endDate);
      
      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }
    }

    // Validar presupuesto disponible
    const budgetValidation = await this.businessRules.validateProjectBudget('', createProjectDto.budget);
    if (!budgetValidation.isValid) {
      throw new BadRequestException(
        `Insufficient budget. Available: $${budgetValidation.availableBudget}, Required: $${createProjectDto.budget}`
      );
    }

    // Buscar próxima asamblea para auto-asignar
    const nextAssembly = await this.prisma.assembly.findFirst({
      where: {
        date: { gte: new Date() },
        status: 'SCHEDULED',
        houseId: createProjectDto.houseId,
      },
      orderBy: { date: 'asc' },
    });

    // Usar workflow para crear proyecto con propuesta automática
    const result = await this.workflowService.createProjectWorkflow({
      title: createProjectDto.title,
      description: createProjectDto.description,
      budget: createProjectDto.budget,
      houseId: createProjectDto.houseId,
      userId,
      assemblyId: nextAssembly?.id,
    });

    // Retornar proyecto con información adicional del workflow
    return {
      ...result.project,
      house: { id: house.id, name: house.name },
      transactions: [],
      proposal: result.proposal,
      voting: result.voting,
      workflow: {
        proposalCreated: !!result.proposal,
        votingCreated: !!result.voting,
        assemblyAssigned: !!nextAssembly,
      },
    };
  }

  async findAll(query: ProjectQueryDto = {}) {
    const {
      houseId,
      status,
      minBudget,
      maxBudget,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
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

    if (minBudget !== undefined || maxBudget !== undefined) {
      where.budget = {};
      if (minBudget !== undefined) where.budget.gte = minBudget;
      if (maxBudget !== undefined) where.budget.lte = maxBudget;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validar campo de ordenamiento
    const allowedSortFields = ['createdAt', 'title', 'budget', 'status', 'startDate', 'endDate'];
    const orderBy = allowedSortFields.includes(sortBy) 
      ? { [sortBy]: sortOrder as 'asc' | 'desc' } 
      : { createdAt: 'desc' as 'desc' };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          house: {
            select: { id: true, name: true },
          },
          transactions: {
            select: { id: true, amount: true, type: true },
          },
          _count: {
            select: { transactions: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        house: {
          select: { id: true, name: true, address: true },
        },
        transactions: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { date: 'desc' },
        },
        proposals: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Calcular gastos del proyecto
    const totalSpent = project.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const remainingBudget = project.budget - totalSpent;
    const budgetUsedPercent = project.budget > 0 ? (totalSpent / project.budget) * 100 : 0;

    return {
      ...project,
      financials: {
        totalSpent,
        remainingBudget,
        budgetUsedPercent: Math.round(budgetUsedPercent * 100) / 100,
        isOverBudget: totalSpent > project.budget,
      },
    };
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    // Validar transición de estado si se está actualizando
    if (updateProjectDto.status) {
      this.validateStatusTransition(existingProject.status, updateProjectDto.status);
    }

    // Validar fechas si se están actualizando
    const startDate = updateProjectDto.startDate ? new Date(updateProjectDto.startDate) : existingProject.startDate;
    const endDate = updateProjectDto.endDate ? new Date(updateProjectDto.endDate) : existingProject.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Si se está marcando como completado, establecer fecha de fin si no existe
    const updateData: any = { ...updateProjectDto };
    if (updateProjectDto.status === 'COMPLETED' && !existingProject.endDate && !updateProjectDto.endDate) {
      updateData.endDate = new Date();
    }

    // Si se está iniciando el proyecto, establecer fecha de inicio si no existe
    if (updateProjectDto.status === 'IN_PROGRESS' && !existingProject.startDate && !updateProjectDto.startDate) {
      updateData.startDate = new Date();
    }

    // Convertir fechas de string a Date
    if (updateData.startDate && typeof updateData.startDate === 'string') {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate && typeof updateData.endDate === 'string') {
      updateData.endDate = new Date(updateData.endDate);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        house: {
          select: { id: true, name: true },
        },
        transactions: {
          select: { id: true, amount: true, type: true },
        },
      },
    });

    return project;
  }

  async updateStatus(id: string, updateStatusDto: UpdateProjectStatusDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    // Usar reglas de negocio para validar transición
    if (!this.businessRules.canTransitionProjectStatus(existingProject.status, updateStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${existingProject.status} to ${updateStatusDto.status}`
      );
    }

    const updateData: any = { status: updateStatusDto.status };

    // Manejar fechas automáticamente según el estado
    if (updateStatusDto.status === 'IN_PROGRESS' && !existingProject.startDate) {
      updateData.startDate = new Date();
    }

    if (updateStatusDto.status === 'COMPLETED' && !existingProject.endDate) {
      updateData.endDate = new Date();
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        house: {
          select: { id: true, name: true },
        },
      },
    });

    return project;
  }

  async remove(id: string) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    // No permitir eliminar proyectos con transacciones asociadas
    if (existingProject._count.transactions > 0) {
      throw new BadRequestException(
        'Cannot delete project with associated transactions. Cancel the project instead.'
      );
    }

    // Solo permitir eliminar proyectos en estado PROPOSED
    if (existingProject.status !== 'PROPOSED') {
      throw new BadRequestException(
        'Can only delete projects in PROPOSED status. Cancel the project instead.'
      );
    }

    await this.prisma.project.delete({
      where: { id },
    });
  }

  async getProjectsByHouse(houseId: string, status?: ProjectStatus) {
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

    return this.prisma.project.findMany({
      where,
      include: {
        house: {
          select: { id: true, name: true },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectStats(houseId?: string): Promise<ProjectStatsDto> {
    const where = houseId ? { houseId } : {};

    const [projects, statusCounts] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: { budget: true, status: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    const total = projects.length;
    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const averageBudget = total > 0 ? totalBudget / total : 0;

    const byStatus = {
      PROPOSED: 0,
      APPROVED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      byStatus[status] = _count;
    });

    const completedProjects = byStatus.COMPLETED;
    const activeProjects = byStatus.APPROVED + byStatus.IN_PROGRESS;

    return {
      total,
      byStatus,
      totalBudget,
      averageBudget: Math.round(averageBudget * 100) / 100,
      completedProjects,
      activeProjects,
    };
  }

  private validateStatusTransition(currentStatus: ProjectStatus, newStatus: ProjectStatus) {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      PROPOSED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // Los proyectos completados no pueden cambiar de estado
      CANCELLED: [], // Los proyectos cancelados no pueden cambiar de estado
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  async getProjectProposals(projectId: string) {
    // Verificar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return await this.prisma.proposal.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { select: { id: true, title: true, status: true } },
        voting: { select: { id: true, title: true, type: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
