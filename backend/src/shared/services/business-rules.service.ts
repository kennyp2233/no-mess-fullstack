import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ProjectStatus,
  AssemblyStatus,
  ProposalStatus,
  ProposalType,
  VotingType,
  VoteOption,
} from '@prisma/client';

@Injectable()
export class BusinessRulesService {
  constructor(private prisma: PrismaService) {}

  // Project Business Rules
  canTransitionProjectStatus(
    currentStatus: ProjectStatus,
    newStatus: ProjectStatus,
  ): boolean {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      [ProjectStatus.PROPOSED]: [ProjectStatus.APPROVED, ProjectStatus.CANCELLED],
      [ProjectStatus.APPROVED]: [
        ProjectStatus.IN_PROGRESS,
        ProjectStatus.CANCELLED,
      ],
      [ProjectStatus.IN_PROGRESS]: [
        ProjectStatus.COMPLETED,
        ProjectStatus.CANCELLED,
      ],
      [ProjectStatus.COMPLETED]: [],
      [ProjectStatus.CANCELLED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Assembly Business Rules
  canTransitionAssemblyStatus(
    currentStatus: AssemblyStatus,
    newStatus: AssemblyStatus,
  ): boolean {
    const validTransitions: Record<AssemblyStatus, AssemblyStatus[]> = {
      [AssemblyStatus.SCHEDULED]: [
        AssemblyStatus.IN_PROGRESS,
        AssemblyStatus.CANCELLED,
      ],
      [AssemblyStatus.IN_PROGRESS]: [
        AssemblyStatus.COMPLETED,
        AssemblyStatus.CANCELLED,
      ],
      [AssemblyStatus.COMPLETED]: [],
      [AssemblyStatus.CANCELLED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Proposal Business Rules
  canTransitionProposalStatus(
    currentStatus: ProposalStatus,
    newStatus: ProposalStatus,
  ): boolean {
    const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
      [ProposalStatus.PENDING]: [
        ProposalStatus.APPROVED,
        ProposalStatus.REJECTED,
      ],
      [ProposalStatus.APPROVED]: [],
      [ProposalStatus.REJECTED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Quorum Validation
  async validateQuorum(
    votingId: string,
    votingType: VotingType,
  ): Promise<{ hasQuorum: boolean; votesCount: number; requiredVotes: number }> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        assembly: {
          include: {
            house: true,
          },
        },
        votes: true,
      },
    });

    if (!voting) {
      throw new Error('Voting not found');
    }

    // For now, we'll use a fixed number of eligible voters
    // In a real system, this would be based on house membership
    const totalEligibleVotes = 10; // Default number of eligible voters
    const actualVotes = voting.votes.length;

    let requiredVotes: number;
    switch (votingType) {
      case VotingType.SIMPLE_MAJORITY:
        requiredVotes = Math.ceil(totalEligibleVotes * 0.5);
        break;
      case VotingType.QUALIFIED_MAJORITY:
        requiredVotes = Math.ceil(totalEligibleVotes * 0.6);
        break;
      case VotingType.UNANIMITY:
        requiredVotes = totalEligibleVotes;
        break;
      default:
        requiredVotes = Math.ceil(totalEligibleVotes * 0.5);
    }

    return {
      hasQuorum: actualVotes >= requiredVotes,
      votesCount: actualVotes,
      requiredVotes,
    };
  }

  // Calculate Voting Results
  async calculateVotingResults(votingId: string): Promise<{
    totalVotes: number;
    yesVotes: number;
    noVotes: number;
    abstainVotes: number;
    isPassed: boolean;
    votingType: VotingType;
  }> {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        votes: true,
      },
    });

    if (!voting) {
      throw new Error('Voting not found');
    }

    const totalVotes = voting.votes.length;
    const yesVotes = voting.votes.filter((vote) => vote.option === VoteOption.YES).length;
    const noVotes = voting.votes.filter((vote) => vote.option === VoteOption.NO).length;
    const abstainVotes = voting.votes.filter((vote) => vote.option === VoteOption.ABSTAIN).length;

    let isPassed = false;
    switch (voting.type) {
      case VotingType.SIMPLE_MAJORITY:
        isPassed = yesVotes > noVotes;
        break;
      case VotingType.QUALIFIED_MAJORITY:
        isPassed = yesVotes >= totalVotes * 0.6;
        break;
      case VotingType.UNANIMITY:
        isPassed = yesVotes === totalVotes && abstainVotes === 0;
        break;
    }

    return {
      totalVotes,
      yesVotes,
      noVotes,
      abstainVotes,
      isPassed,
      votingType: voting.type,
    };
  }

  // Assembly Scheduling Rules
  async validateAssemblyScheduling(
    scheduledDate: Date,
    excludeAssemblyId?: string,
  ): Promise<{ isValid: boolean; conflictingAssemblies: any[] }> {
    // For demo purposes, always allow assembly scheduling
    // In production, this would check for actual conflicts
    return {
      isValid: true,
      conflictingAssemblies: [],
    };
  }

  // Project Budget Validation
  async validateProjectBudget(
    projectId: string,
    amount: number,
  ): Promise<{ isValid: boolean; availableBudget: number }> {
    // For demo purposes, always return valid
    // In production, this would check actual budgets
    return {
      isValid: true,
      availableBudget: 1000000, // Mock available budget
    };
  }

  // House Eligibility for Voting
  async isHouseEligibleForVoting(houseId: string): Promise<boolean> {
    const house = await this.prisma.house.findUnique({
      where: { id: houseId },
      include: {
        transactions: {
          where: {
            type: 'EXPENSE',
            // Check if maintenance fees are up to date (last 3 months)
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    if (!house) return false;

    // House is eligible if it has paid maintenance in the last 3 months
    return house.transactions.length > 0;
  }

  // Notification Rules
  getNotificationRecipients(
    eventType: string,
    entityId: string,
  ): Promise<string[]> {
    // Return user IDs that should receive notifications for this event
    // This would be implemented based on notification preferences
    return Promise.resolve([]);
  }
}
