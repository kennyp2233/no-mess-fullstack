import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { VoteOption } from '@prisma/client';

export interface VotingResults {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  yesPercentage: number;
  noPercentage: number;
  abstainPercentage: number;
  quorumMet: boolean;
  passed: boolean;
  eligibleVoters: number;
  turnoutPercentage: number;
}

export interface ProposalResults {
  proposalId: string;
  title: string;
  results: VotingResults;
}

export interface RealTimeStatsResponse {
  votingId: string;
  title: string;
  status: string;
  startDate: Date;
  endDate: Date;
  quorumPercentage: number;
  eligibleVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  quorumMet: boolean;
  timeRemaining: number | null;
  proposals: ProposalDetailedStats[];
}

export interface ProposalDetailedStats {
  proposalId: string;
  title: string;
  description: string;
  totalVotes: number;
  voteBreakdown: {
    YES: { count: number; percentage: number };
    NO: { count: number; percentage: number };
    ABSTAIN: { count: number; percentage: number };
  };
  passed: boolean;
  quorumMet: boolean;
}

export interface VotingParticipantsResponse {
  votingId: string;
  eligibleVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  participants: {
    voted: VotingParticipant[];
    notVoted: VotingParticipant[];
  };
}

export interface VotingParticipant {
  userId: string;
  name: string;
  email: string;
  hasVoted: boolean;
  votedAt?: Date;
}

@Injectable()
export class VotingStatsService {
  constructor(private prisma: PrismaService) {}

  async getRealTimeStats(votingId: string): Promise<RealTimeStatsResponse> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: {
              include: {
                users: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        proposals: true,
        votes: true
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const eligibleVoters = voting.assembly.house.users.length;
    const totalVotesCast = voting.votes.length;
    const turnoutPercentage = eligibleVoters > 0 ? (totalVotesCast / eligibleVoters) * 100 : 0;
    
    // Use requiredQuorum field from schema
    const requiredQuorum = voting.requiredQuorum || 50;
    const quorumMet = turnoutPercentage >= requiredQuorum;

    // Calcular tiempo restante (asumir que está activa si no ha terminado)
    const now = new Date();
    const endDate = new Date(voting.endDate);
    const isActive = endDate > now;
    const timeRemaining = isActive ? Math.max(0, endDate.getTime() - now.getTime()) : null;

    // Calcular estadísticas detalladas por propuesta
    const proposalStats = await Promise.all(
      voting.proposals.map(async (proposal) => {
        const proposalVotes = await this.prisma.vote.findMany({
          where: { 
            votingId: voting.id,
            // Assuming we need to link proposals to votes somehow
            // For now, we'll get all votes for the voting
          }
        });

        const yesVotes = proposalVotes.filter(vote => vote.option === VoteOption.YES).length;
        const noVotes = proposalVotes.filter(vote => vote.option === VoteOption.NO).length;
        const abstainVotes = proposalVotes.filter(vote => vote.option === VoteOption.ABSTAIN).length;
        const totalProposalVotes = proposalVotes.length;

        const yesPercentage = totalProposalVotes > 0 ? (yesVotes / totalProposalVotes) * 100 : 0;
        const noPercentage = totalProposalVotes > 0 ? (noVotes / totalProposalVotes) * 100 : 0;
        const abstainPercentage = totalProposalVotes > 0 ? (abstainVotes / totalProposalVotes) * 100 : 0;

        // Determinar si la propuesta ha pasado
        const proposalQuorumMet = totalProposalVotes >= (eligibleVoters * requiredQuorum / 100);
        const passed = proposalQuorumMet && yesPercentage > 50;

        return {
          proposalId: proposal.id,
          title: proposal.title,
          description: proposal.description,
          totalVotes: totalProposalVotes,
          voteBreakdown: {
            YES: { count: yesVotes, percentage: yesPercentage },
            NO: { count: noVotes, percentage: noPercentage },
            ABSTAIN: { count: abstainVotes, percentage: abstainPercentage }
          },
          passed,
          quorumMet: proposalQuorumMet
        };
      })
    );

    return {
      votingId: voting.id,
      title: voting.title,
      status: isActive ? 'ACTIVE' : 'CLOSED',
      startDate: voting.startDate,
      endDate: voting.endDate,
      quorumPercentage: requiredQuorum,
      eligibleVoters,
      totalVotesCast,
      turnoutPercentage,
      quorumMet,
      timeRemaining,
      proposals: proposalStats
    };
  }

  async getVotingParticipants(votingId: string): Promise<VotingParticipantsResponse> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: {
              include: {
                users: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        votes: {
          include: {
            user: true
          }
        }
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const eligibleUsers = voting.assembly.house.users.map(houseUser => houseUser.user);
    const votersMap = new Map(voting.votes.map(vote => [vote.userId, vote]));

    const participants = eligibleUsers.map(user => {
      const vote = votersMap.get(user.id);
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        hasVoted: !!vote,
        votedAt: vote?.createdAt
      };
    });

    const voted = participants.filter(p => p.hasVoted);
    const notVoted = participants.filter(p => !p.hasVoted);

    const eligibleVoters = eligibleUsers.length;
    const totalVotesCast = voted.length;
    const turnoutPercentage = eligibleVoters > 0 ? (totalVotesCast / eligibleVoters) * 100 : 0;

    return {
      votingId: voting.id,
      eligibleVoters,
      totalVotesCast,
      turnoutPercentage,
      participants: {
        voted,
        notVoted
      }
    };
  }

  async calculateVotingResults(votingId: string): Promise<VotingResults> {
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
    const votes = voting.votes;

    const yesVotes = votes.filter(vote => vote.option === VoteOption.YES).length;
    const noVotes = votes.filter(vote => vote.option === VoteOption.NO).length;
    const abstainVotes = votes.filter(vote => vote.option === VoteOption.ABSTAIN).length;
    const totalVotes = votes.length;

    const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
    const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
    const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;
    const turnoutPercentage = eligibleVoters > 0 ? (totalVotes / eligibleVoters) * 100 : 0;

    const requiredQuorum = voting.requiredQuorum || 50;
    const quorumMet = turnoutPercentage >= requiredQuorum;
    const passed = quorumMet && yesPercentage > 50;

    return {
      totalVotes,
      yesVotes,
      noVotes,
      abstainVotes,
      yesPercentage,
      noPercentage,
      abstainPercentage,
      quorumMet,
      passed,
      eligibleVoters,
      turnoutPercentage
    };
  }

  async calculateProposalResults(votingId: string): Promise<ProposalResults[]> {
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
        proposals: true
      }
    });

    if (!voting) {
      throw new NotFoundException('Voting not found');
    }

    const eligibleVoters = voting.assembly.house.users.length;
    const requiredQuorum = voting.requiredQuorum || 50;

    return Promise.all(
      voting.proposals.map(async (proposal) => {
        // Get votes for this specific voting (all votes are for all proposals in the voting)
        const votes = await this.prisma.vote.findMany({
          where: { votingId: voting.id }
        });

        const yesVotes = votes.filter(vote => vote.option === VoteOption.YES).length;
        const noVotes = votes.filter(vote => vote.option === VoteOption.NO).length;
        const abstainVotes = votes.filter(vote => vote.option === VoteOption.ABSTAIN).length;
        const totalVotes = votes.length;

        const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
        const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
        const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;
        const turnoutPercentage = eligibleVoters > 0 ? (totalVotes / eligibleVoters) * 100 : 0;

        const quorumMet = turnoutPercentage >= requiredQuorum;
        const passed = quorumMet && yesPercentage > 50;

        return {
          proposalId: proposal.id,
          title: proposal.title,
          results: {
            totalVotes,
            yesVotes,
            noVotes,
            abstainVotes,
            yesPercentage,
            noPercentage,
            abstainPercentage,
            quorumMet,
            passed,
            eligibleVoters,
            turnoutPercentage
          }
        };
      })
    );
  }
}
