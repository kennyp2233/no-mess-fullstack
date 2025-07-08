import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

export interface QuorumStatusResponse {
  votingId: string;
  title: string;
  requiredQuorum: number;
  currentTurnout: number;
  quorumMet: boolean;
  eligibleVoters: number;
  totalVotesCast: number;
  votesNeededForQuorum: number;
  timeRemaining: number | null;
  canAutoClose: boolean;
  recommendations: string[];
  thresholds: {
    quorumThreshold: number;
    passThreshold: number;
    unanimityRequired: boolean;
  };
}

@Injectable()
export class VotingQuorumService {
  constructor(private prisma: PrismaService) {}

  async checkQuorumStatus(votingId: string): Promise<QuorumStatusResponse> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: {
              include: {
                users: true
              }
            }
          }
        },
        votes: true
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const eligibleVoters = voting.assembly.house.users.length;
    const totalVotesCast = voting.votes.length;
    const requiredQuorum = voting.requiredQuorum || 50;
    const currentTurnout = eligibleVoters > 0 ? (totalVotesCast / eligibleVoters) * 100 : 0;
    
    const quorumMet = currentTurnout >= requiredQuorum;
    const votesNeededForQuorum = Math.max(0, Math.ceil((eligibleVoters * requiredQuorum) / 100) - totalVotesCast);

    // Calcular tiempo restante
    const now = new Date();
    const endDate = new Date(voting.endDate);
    const timeRemaining = endDate > now ? Math.max(0, endDate.getTime() - now.getTime()) : null;

    // Determinar si puede auto-cerrarse
    const canAutoClose = this.canAutoCloseVoting(voting, quorumMet, endDate, now);

    // Generar recomendaciones
    const recommendations = this.generateQuorumRecommendations(
      quorumMet, 
      currentTurnout, 
      requiredQuorum, 
      votesNeededForQuorum, 
      timeRemaining
    );

    // Determinar thresholds según el tipo de votación
    const thresholds = this.getVotingThresholds(voting.type);

    return {
      votingId: voting.id,
      title: voting.title,
      requiredQuorum,
      currentTurnout,
      quorumMet,
      eligibleVoters,
      totalVotesCast,
      votesNeededForQuorum,
      timeRemaining,
      canAutoClose,
      recommendations,
      thresholds
    };
  }

  async validateQuorumRequirements(votingId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: {
              include: {
                users: true
              }
            }
          }
        }
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const eligibleVoters = voting.assembly.house.users.length;
    const requiredQuorum = voting.requiredQuorum || 50;

    // Validar que hay suficientes votantes elegibles
    if (eligibleVoters === 0) {
      errors.push('No eligible voters found for this voting');
    }

    // Validar porcentaje de quórum
    if (requiredQuorum < 0 || requiredQuorum > 100) {
      errors.push('Quorum percentage must be between 0 and 100');
    }

    // Advertencias basadas en el tipo de votación
    switch (voting.type) {
      case 'UNANIMITY':
        if (requiredQuorum < 100) {
          warnings.push('Unanimity voting requires 100% quorum, but current requirement is lower');
        }
        break;
      case 'QUALIFIED_MAJORITY':
        if (requiredQuorum < 67) {
          warnings.push('Qualified majority typically requires at least 67% quorum');
        }
        break;
      case 'SIMPLE_MAJORITY':
        if (requiredQuorum < 50) {
          warnings.push('Simple majority typically requires at least 50% quorum');
        }
        break;
    }

    // Advertencia si el quórum es muy alto
    if (requiredQuorum > 90) {
      warnings.push('Very high quorum requirement may make it difficult to reach consensus');
    }

    // Advertencia si hay pocos votantes elegibles
    if (eligibleVoters < 3) {
      warnings.push('Very few eligible voters may affect voting legitimacy');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private canAutoCloseVoting(voting: any, quorumMet: boolean, endDate: Date, now: Date): boolean {
    // Puede auto-cerrarse si:
    // 1. Ha llegado la fecha de fin
    // 2. Se ha alcanzado el quórum requerido para unanimidad
    // 3. Es imposible alcanzar el quórum (no hay suficientes votantes restantes)
    
    if (endDate <= now) {
      return true;
    }

    if (voting.type === 'UNANIMITY' && quorumMet) {
      return true;
    }

    // TODO: Implementar lógica para detectar si es imposible alcanzar quórum
    // (requeriría conocer cuántos usuarios están activos/disponibles)

    return false;
  }

  private generateQuorumRecommendations(
    quorumMet: boolean,
    currentTurnout: number,
    requiredQuorum: number,
    votesNeeded: number,
    timeRemaining: number | null
  ): string[] {
    const recommendations: string[] = [];

    if (!quorumMet) {
      recommendations.push(`Quorum not yet reached. Need ${votesNeeded} more votes to meet ${requiredQuorum}% requirement.`);
      
      if (timeRemaining) {
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        if (hoursRemaining < 24) {
          recommendations.push('Consider sending reminder notifications to increase participation.');
        }
        if (hoursRemaining < 2) {
          recommendations.push('Urgent: Very little time remaining to reach quorum.');
        }
      }
    } else {
      recommendations.push('Quorum has been reached. Voting can proceed or be closed.');
    }

    if (currentTurnout < 30) {
      recommendations.push('Low participation detected. Consider reviewing notification strategy.');
    } else if (currentTurnout > 80) {
      recommendations.push('Excellent participation! Consider closing voting soon.');
    }

    return recommendations;
  }

  private getVotingThresholds(votingType: string) {
    switch (votingType) {
      case 'UNANIMITY':
        return {
          quorumThreshold: 100,
          passThreshold: 100,
          unanimityRequired: true
        };
      case 'QUALIFIED_MAJORITY':
        return {
          quorumThreshold: 67,
          passThreshold: 67,
          unanimityRequired: false
        };
      case 'SIMPLE_MAJORITY':
      default:
        return {
          quorumThreshold: 50,
          passThreshold: 50,
          unanimityRequired: false
        };
    }
  }

  async getQuorumHistory(votingId: string) {
    const votes = await this.prisma.vote.findMany({
      where: { votingId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: {
              include: {
                users: true
              }
            }
          }
        }
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const eligibleVoters = voting.assembly.house.users.length;
    const requiredQuorum = voting.requiredQuorum || 50;

    // Crear timeline de cómo evolucionó el quórum
    const quorumHistory = votes.map((vote, index) => {
      const votesCast = index + 1;
      const turnoutPercentage = (votesCast / eligibleVoters) * 100;
      const quorumMet = turnoutPercentage >= requiredQuorum;

      return {
        timestamp: vote.createdAt,
        voterName: vote.user.name,
        votesCast,
        turnoutPercentage: Math.round(turnoutPercentage * 100) / 100,
        quorumMet,
        votesNeededForQuorum: Math.max(0, Math.ceil((eligibleVoters * requiredQuorum) / 100) - votesCast)
      };
    });

    return {
      votingId,
      eligibleVoters,
      requiredQuorum,
      history: quorumHistory
    };
  }
}
