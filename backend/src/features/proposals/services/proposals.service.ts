import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { WorkflowService, BusinessRulesService } from '../../../shared/services';
import { CreateProposalDto, UpdateProposalDto, UpdateProposalStatusDto, ProposalQueryDto } from '../dto';
import { ProposalType, ProposalStatus } from '@prisma/client';

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
    private businessRules: BusinessRulesService,
  ) {}

  async create(createProposalDto: CreateProposalDto, userId: string) {
    // Validaciones específicas por tipo de propuesta
    await this.validateProposalType(createProposalDto);

    // Validar relaciones opcionales
    if (createProposalDto.assemblyId) {
      await this.validateAssemblyExists(createProposalDto.assemblyId);
    }

    if (createProposalDto.votingId) {
      await this.validateVotingExists(createProposalDto.votingId);
    }

    if (createProposalDto.projectId) {
      await this.validateProjectExists(createProposalDto.projectId);
    }

    // Usar workflow para crear propuesta con auto-asignación a asamblea
    const workflowResult = await this.workflowService.createProposalWorkflow({
      title: createProposalDto.title,
      description: createProposalDto.description,
      proposalType: createProposalDto.proposalType,
      userId: userId,
      projectId: createProposalDto.projectId,
    });

    // Completar datos desde los DTOs si están presentes
    if (createProposalDto.assemblyId || createProposalDto.votingId) {
      await this.prisma.proposal.update({
        where: { id: workflowResult.proposal.id },
        data: {
          assemblyId: createProposalDto.assemblyId,
          votingId: createProposalDto.votingId,
        },
      });
    }

    // Retornar propuesta completa con información del workflow
    const completeProposal = await this.prisma.proposal.findUnique({
      where: { id: workflowResult.proposal.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { select: { id: true, title: true, status: true } },
        voting: { select: { id: true, title: true, type: true } },
        project: { select: { id: true, title: true, status: true } }
      }
    });

    return {
      ...completeProposal,
      workflow: {
        autoAssignedToAssembly: !!workflowResult.assembly,
        assemblyDate: workflowResult.assembly?.date,
      },
    };
  }

  async findAll(query: ProposalQueryDto) {
    const { page = 1, limit = 10, search, proposalType, status, assemblyId, votingId, projectId, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (proposalType) {
      where.proposalType = proposalType;
    }

    if (status) {
      where.status = status;
    }

    if (assemblyId) {
      where.assemblyId = assemblyId;
    }

    if (votingId) {
      where.votingId = votingId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (userId) {
      where.userId = userId;
    }

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          assembly: { select: { id: true, title: true, status: true } },
          voting: { select: { id: true, title: true, type: true } },
          project: { select: { id: true, title: true, status: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.proposal.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { 
          select: { 
            id: true, 
            title: true, 
            status: true, 
            date: true,
            house: { select: { id: true, name: true } }
          } 
        },
        voting: { 
          select: { 
            id: true, 
            title: true, 
            type: true, 
            startDate: true, 
            endDate: true 
          } 
        },
        project: { 
          select: { 
            id: true, 
            title: true, 
            status: true, 
            budget: true,
            house: { select: { id: true, name: true } }
          } 
        }
      }
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return proposal;
  }

  async update(id: string, updateProposalDto: UpdateProposalDto, userId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Solo el creador o un admin puede actualizar
    if (proposal.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new ForbiddenException('Only the proposal creator or admin can update this proposal');
      }
    }

    // No permitir cambios si ya fue aprobada o rechazada
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Cannot update proposal that has been approved or rejected');
    }

    // Validaciones si se cambia el tipo
    if (updateProposalDto.proposalType && updateProposalDto.proposalType !== proposal.proposalType) {
      await this.validateProposalType({ ...proposal, ...updateProposalDto } as any);
    }

    return await this.prisma.proposal.update({
      where: { id },
      data: updateProposalDto,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { select: { id: true, title: true, status: true } },
        voting: { select: { id: true, title: true, type: true } },
        project: { select: { id: true, title: true, status: true } }
      }
    });
  }

  async updateStatus(id: string, updateStatusDto: UpdateProposalStatusDto, userId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { 
        user: true,
        assembly: { include: { house: true } },
        project: true 
      }
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Solo admins o usuarios con permisos específicos pueden cambiar el estado
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { houses: { include: { house: true } } }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'PRESIDENT') {
      throw new ForbiddenException('Only admins or presidents can change proposal status');
    }

    // Validar transiciones de estado
    this.validateStatusTransition(proposal.status, updateStatusDto.status);

    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { status: updateStatusDto.status },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { select: { id: true, title: true, status: true } },
        voting: { select: { id: true, title: true, type: true } },
        project: { select: { id: true, title: true, status: true } }
      }
    });

    // Si la propuesta es aprobada y está asociada a un proyecto, aprobar el proyecto también
    if (updateStatusDto.status === ProposalStatus.APPROVED && proposal.projectId) {
      await this.handleProjectApproval(proposal.projectId);
    }

    return updatedProposal;
  }

  async getProposalStats() {
    const [total, byStatus, byType, recentCount] = await Promise.all([
      this.prisma.proposal.count(),
      this.prisma.proposal.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      this.prisma.proposal.groupBy({
        by: ['proposalType'],
        _count: { proposalType: true }
      }),
      this.prisma.proposal.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
          }
        }
      })
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item.proposalType] = item._count.proposalType;
        return acc;
      }, {} as Record<string, number>),
      recentCount
    };
  }

  async getProposalsByAssembly(assemblyId: string) {
    return await this.prisma.proposal.findMany({
      where: { assemblyId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        voting: { select: { id: true, title: true, type: true } },
        project: { select: { id: true, title: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getProposalsByVoting(votingId: string) {
    return await this.prisma.proposal.findMany({
      where: { votingId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assembly: { select: { id: true, title: true, status: true } },
        project: { select: { id: true, title: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getProposalsByProject(projectId: string) {
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

  async remove(id: string, userId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Solo el creador o un admin puede eliminar
    if (proposal.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new ForbiddenException('Only the proposal creator or admin can delete this proposal');
      }
    }

    // No permitir eliminar si ya fue aprobada
    if (proposal.status === ProposalStatus.APPROVED) {
      throw new BadRequestException('Cannot delete approved proposals');
    }

    await this.prisma.proposal.delete({ where: { id } });
  }

  // Métodos privados de validación
  private async validateProposalType(proposalData: CreateProposalDto | any) {
    switch (proposalData.proposalType) {
      case ProposalType.PROJECT_APPROVAL:
        if (!proposalData.projectId) {
          throw new BadRequestException('PROJECT_APPROVAL proposals must be associated with a project');
        }
        break;
      
      case ProposalType.BUDGET_APPROVAL:
        if (!proposalData.assemblyId) {
          throw new BadRequestException('BUDGET_APPROVAL proposals must be associated with an assembly');
        }
        break;
      
      case ProposalType.ALIQUOT_CHANGE:
      case ProposalType.REGULATION_CHANGE:
      case ProposalType.EXTRAORDINARY_FEE:
        if (!proposalData.assemblyId) {
          throw new BadRequestException(`${proposalData.proposalType} proposals must be associated with an assembly`);
        }
        break;
      
      // OTHER type doesn't require specific associations
      default:
        break;
    }
  }

  private async validateAssemblyExists(assemblyId: string) {
    const assembly = await this.prisma.assembly.findUnique({ where: { id: assemblyId } });
    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }
  }

  private async validateVotingExists(votingId: string) {
    const voting = await this.prisma.voting.findUnique({ where: { id: votingId } });
    if (!voting) {
      throw new NotFoundException('Voting not found');
    }
  }

  private async validateProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private validateStatusTransition(currentStatus: ProposalStatus, newStatus: ProposalStatus) {
    const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
      [ProposalStatus.PENDING]: [ProposalStatus.APPROVED, ProposalStatus.REJECTED],
      [ProposalStatus.APPROVED]: [], // No se puede cambiar una vez aprobada
      [ProposalStatus.REJECTED]: [ProposalStatus.PENDING] // Puede volver a revisión
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async handleProjectApproval(projectId: string) {
    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'APPROVED' }
      });
    } catch (error) {
      // Log error but don't fail the proposal approval
      console.error('Error approving related project:', error);
    }
  }
}
