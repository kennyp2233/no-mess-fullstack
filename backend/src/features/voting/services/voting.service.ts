import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CreateVotingDto, CastVoteDto, UpdateVotingDto, VotingQueryDto } from '../dto';
import { VotingType, VoteOption, ProposalStatus } from '@prisma/client';
import { VotingWebSocketService } from '../websockets/voting-websocket.service';
import { VotingStatsService, VotingResults, ProposalResults } from './voting-stats.service';
import { VotingQuorumService } from './voting-quorum.service';
import { VotingNotificationService } from './voting-notification.service';
import { VotingSchedulerService } from './voting-scheduler.service';

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => VotingWebSocketService))
    private votingWebSocketService: VotingWebSocketService,
    private votingStatsService: VotingStatsService,
    private votingQuorumService: VotingQuorumService,
    private votingNotificationService: VotingNotificationService,
    private votingSchedulerService: VotingSchedulerService
  ) {}

  async create(createVotingDto: CreateVotingDto, userId: string) {
    const { proposals, ...votingData } = createVotingDto;

    // Verificar que la asamblea existe y el usuario tiene permisos
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: createVotingDto.assemblyId },
      include: { house: true }
    });

    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }

    // Verificar que las fechas son válidas
    const startDate = new Date(createVotingDto.startDate);
    const endDate = new Date(createVotingDto.endDate);
    
    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Comentado para permitir pruebas
    // if (startDate < new Date()) {
    //   throw new BadRequestException('Start date cannot be in the past');
    // }

    // Crear la votación y sus propuestas en una transacción
    return await this.prisma.$transaction(async (tx) => {
      const voting = await tx.voting.create({
        data: {
          ...votingData,
          startDate,
          endDate,
        },
        include: {
          assembly: {
            include: { house: true }
          }
        }
      });

      // Crear las propuestas asociadas
      const createdProposals = await Promise.all(
        proposals.map(proposal =>
          tx.proposal.create({
            data: {
              title: proposal.title,
              description: proposal.description,
              proposalType: proposal.proposalType,
              userId: userId,
              assemblyId: assembly.id,
              votingId: voting.id,
            }
          })
        )
      );

      const result = {
        ...voting,
        proposals: createdProposals
      };

      // Programar timeout automático
      await this.votingSchedulerService.scheduleVotingTimeout(voting.id, voting.endDate);

      // Notificar a usuarios elegibles sobre nueva votación
      await this.notifyEligibleUsers(voting);

      return result;
    });
  }

  async findAll(query: VotingQueryDto) {
    const { page = 1, limit = 10, search, type, assemblyId, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (type) {
      where.type = type;
    }

    if (assemblyId) {
      where.assemblyId = assemblyId;
    }

    // Filtros por estado calculado
    const now = new Date();
    if (status === 'active') {
      where.AND = [
        { startDate: { lte: now } },
        { endDate: { gte: now } }
      ];
    } else if (status === 'upcoming') {
      where.startDate = { gt: now };
    } else if (status === 'closed') {
      where.endDate = { lt: now };
    }

    const [data, total] = await Promise.all([
      this.prisma.voting.findMany({
        where,
        skip,
        take: limit,
        include: {
          assembly: {
            include: { house: true }
          },
          proposals: true,
          votes: {
            include: { user: { select: { id: true, name: true, email: true } } }
          },
          _count: { select: { votes: true, proposals: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.voting.count({ where })
    ]);

    // Calcular estado para cada votación
    const votingsWithStatus = data.map(voting => ({
      ...voting,
      status: this.calculateVotingStatus(voting.startDate, voting.endDate),
      results: this.calculateVotingResults(voting, voting.assembly.house.id)
    }));

    return {
      data: votingsWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id },
      include: {
        assembly: {
          include: { house: true }
        },
        proposals: true,
        votes: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const status = this.calculateVotingStatus(voting.startDate, voting.endDate);
    const results = await this.votingStatsService.calculateVotingResults(voting.id);

    return {
      ...voting,
      status,
      results
    };
  }

  async update(id: string, updateVotingDto: UpdateVotingDto) {
    const voting = await this.prisma.voting.findUnique({
      where: { id }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    // Verificar que la votación no haya comenzado
    if (voting.startDate <= new Date()) {
      throw new BadRequestException('Cannot update voting that has already started');
    }

    // Validar fechas si se están actualizando
    if (updateVotingDto.startDate || updateVotingDto.endDate) {
      const startDate = updateVotingDto.startDate ? new Date(updateVotingDto.startDate) : voting.startDate;
      const endDate = updateVotingDto.endDate ? new Date(updateVotingDto.endDate) : voting.endDate;
      
      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }

      if (startDate < new Date()) {
        throw new BadRequestException('Start date cannot be in the past');
      }
    }

    const updateData: any = { ...updateVotingDto };
    if (updateVotingDto.startDate) updateData.startDate = new Date(updateVotingDto.startDate);
    if (updateVotingDto.endDate) updateData.endDate = new Date(updateVotingDto.endDate);

    return await this.prisma.voting.update({
      where: { id },
      data: updateData,
      include: {
        assembly: { include: { house: true } },
        proposals: true,
        votes: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });
  }

  /**
   * Cast vote and handle real-time notifications
   */
  async castVote(castVoteDto: CastVoteDto, userId: string) {
    const { votingId, option, comment } = castVoteDto;

    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: { include: { house: true } },
        votes: true
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    // Verificar que la votación está activa
    const now = new Date();
    if (now < voting.startDate) {
      throw new BadRequestException('Voting has not started yet');
    }

    if (now > voting.endDate) {
      throw new BadRequestException('Voting has ended');
    }

    // Verificar que el usuario pertenece a la casa y puede votar
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        houses: {
          include: { house: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canVote = user.houses.some(houseUser => houseUser.house.id === voting.assembly.house.id);
    if (!canVote) {
      throw new ForbiddenException('User is not eligible to vote in this voting');
    }

    // Verificar que el usuario no ha votado ya
    const existingVote = voting.votes.find(vote => vote.userId === userId);
    if (existingVote) {
      throw new BadRequestException('User has already voted');
    }

    // Registrar el voto
    const vote = await this.prisma.vote.create({
      data: {
        option,
        comment,
        userId,
        votingId
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        voting: { include: { assembly: true } }
      }
    });

    // Obtener estadísticas actualizadas y manejar notificaciones
    try {
      const updatedStats = await this.votingStatsService.getRealTimeStats(votingId);
      
      // Notificar sobre el nuevo voto
      await this.votingNotificationService.notifyVotingUpdate({
        votingId,
        vote: {
          userId: vote.user.id,
          option: vote.option,
          comment: vote.comment
        },
        stats: updatedStats,
        triggeredBy: userId,
        timestamp: new Date()
      });

      // Verificar quórum y auto-cierre
      const quorumStatus = await this.votingQuorumService.checkQuorumStatus(votingId);
      
      if (quorumStatus.quorumMet) {
        await this.votingNotificationService.notifyQuorumReached({
          votingId,
          quorumStatus,
          triggeredBy: userId,
          timestamp: new Date()
        });
      }

      // Verificar si debería auto-cerrarse
      const autoCloseResult = await this.votingSchedulerService.autoCloseVotingIfNeeded(votingId, userId);
      
      if (autoCloseResult.closed) {
        this.logger.log(`Voting ${votingId} auto-closed after vote by user ${userId}: ${autoCloseResult.reason}`);
      }

    } catch (error) {
      this.logger.error('Error handling real-time notifications for vote:', error);
    }

    return vote;
  }

  async getResults(id: string) {
    const voting = await this.findOne(id);
    return {
      voting: {
        id: voting.id,
        title: voting.title,
        type: voting.type,
        status: voting.status
      },
      results: voting.results
    };
  }

  async getVotingStats() {
    const now = new Date();
    
    const [total, active, upcoming, closed] = await Promise.all([
      this.prisma.voting.count(),
      this.prisma.voting.count({
        where: {
          AND: [
            { startDate: { lte: now } },
            { endDate: { gte: now } }
          ]
        }
      }),
      this.prisma.voting.count({
        where: { startDate: { gt: now } }
      }),
      this.prisma.voting.count({
        where: { endDate: { lt: now } }
      })
    ]);

    const byType = await this.prisma.voting.groupBy({
      by: ['type'],
      _count: { type: true }
    });

    return {
      total,
      active,
      upcoming,
      closed,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async remove(id: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    // Solo permitir eliminar si no ha comenzado
    if (voting.startDate <= new Date()) {
      throw new BadRequestException('Cannot delete voting that has already started');
    }

    return await this.prisma.voting.delete({
      where: { id }
    });
  }

  private calculateVotingStatus(startDate: Date, endDate: Date): string {
    const now = new Date();
    
    if (now < startDate) return 'upcoming';
    if (now >= startDate && now <= endDate) return 'active';
    return 'closed';
  }

  private calculateVotingResults(voting: any, houseId: string): VotingResults {
    const votes = voting.votes || [];
    const totalVotes = votes.length;
    
    const yesVotes = votes.filter(vote => vote.option === VoteOption.YES).length;
    const noVotes = votes.filter(vote => vote.option === VoteOption.NO).length;
    const abstainVotes = votes.filter(vote => vote.option === VoteOption.ABSTAIN).length;

    const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
    const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
    const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;

    // Para quórum, necesitaríamos saber cuántos usuarios elegibles hay
    // Por simplicidad, usamos el número de votos actuales vs el mínimo esperado
    const eligibleVoters = Math.max(totalVotes, 5); // Mínimo 5 votantes elegibles
    const turnoutPercentage = (totalVotes / eligibleVoters) * 100;
    
    const requiredQuorum = voting.requiredQuorum || 50;
    const quorumMet = totalVotes > 0 && turnoutPercentage >= requiredQuorum;

    // Determinar si la votación pasó según el tipo
    let passed = false;
    if (quorumMet) {
      switch (voting.type) {
        case VotingType.SIMPLE_MAJORITY:
          passed = yesVotes > noVotes;
          break;
        case VotingType.QUALIFIED_MAJORITY:
          passed = yesPercentage >= 66.67; // 2/3
          break;
        case VotingType.UNANIMITY:
          passed = yesVotes === totalVotes && totalVotes > 0;
          break;
      }
    }

    return {
      totalVotes,
      yesVotes,
      noVotes,
      abstainVotes,
      yesPercentage: Math.round(yesPercentage * 100) / 100,
      noPercentage: Math.round(noPercentage * 100) / 100,
      abstainPercentage: Math.round(abstainPercentage * 100) / 100,
      quorumMet,
      passed,
      eligibleVoters,
      turnoutPercentage: Math.round(turnoutPercentage * 100) / 100
    };
  }

  private async calculateDetailedResults(voting: any): Promise<{ overall: VotingResults; byProposal: ProposalResults[] }> {
    const overall = this.calculateVotingResults(voting, voting.assembly.house.id);
    
    // Por ahora, las propuestas comparten el mismo resultado general
    // En una implementación más avanzada, cada propuesta podría tener votos separados
    const byProposal: ProposalResults[] = voting.proposals.map(proposal => ({
      proposalId: proposal.id,
      title: proposal.title,
      results: overall // Simplificado
    }));

    return { overall, byProposal };
  }

  async getVotingProposals(votingId: string) {
    // Verificar que la votación existe
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

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

  /**
   * Get real-time voting statistics (delegated to VotingStatsService)
   */
  async getRealTimeStats(votingId: string) {
    return await this.votingStatsService.getRealTimeStats(votingId);
  }

  /**
   * Get voting participants (delegated to VotingStatsService)
   */
  async getVotingParticipants(votingId: string) {
    return await this.votingStatsService.getVotingParticipants(votingId);
  }

  /**
   * Check quorum status (delegated to VotingQuorumService)
   */
  async checkQuorumStatus(votingId: string) {
    return await this.votingQuorumService.checkQuorumStatus(votingId);
  }

  /**
   * Auto-close voting if needed (delegated to VotingSchedulerService)
   */
  async autoCloseVotingIfNeeded(votingId: string, triggeredByUserId?: string) {
    return await this.votingSchedulerService.autoCloseVotingIfNeeded(votingId, triggeredByUserId);
  }

  /**
   * Schedule voting timeout (delegated to VotingSchedulerService)
   */
  scheduleVotingTimeout(votingId: string, endDate: Date) {
    return this.votingSchedulerService.scheduleVotingTimeout(votingId, endDate);
  }

  /**
   * Close voting and emit final results
   */
  async closeVoting(votingId: string, userId: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: { include: { house: true } },
        votes: { include: { user: { select: { id: true, name: true, email: true } } } },
        proposals: true
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    // Verificar permisos (simplificado para pruebas)
    // En producción aquí iría validación de roles/permisos

    // Calcular resultados finales
    const finalResults = await this.votingStatsService.getRealTimeStats(votingId);

    // Notificar cierre via servicio de notificaciones
    await this.votingNotificationService.notifyVotingClosed({
      votingId,
      finalResults,
      closedBy: 'USER',
      triggeredBy: userId,
      timestamp: new Date(),
      reason: `Voting closed by user ${userId}`
    });

    return {
      success: true,
      message: 'Voting closed successfully',
      finalResults
    };
  }

  /**
   * Notify eligible users about new voting
   */
  private async notifyEligibleUsers(voting: any) {
    try {
      // Broadcast to general WebSocket about new voting
      this.votingWebSocketService.broadcastToVotingRoom(
        voting.id,
        'voting_created',
        {
          votingId: voting.id,
          title: voting.title,
          description: voting.description,
          startDate: voting.startDate,
          endDate: voting.endDate,
          assemblyId: voting.assemblyId,
          type: voting.type,
          message: `New voting "${voting.title}" has been created`,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error('Error notifying eligible users:', error);
    }
  }
}
