import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { VotingNotificationService } from './voting-notification.service';
import { VotingStatsService } from './voting-stats.service';
import { VotingQuorumService } from './voting-quorum.service';

export interface AutoCloseResult {
  closed: boolean;
  reason: string;
  finalResults?: any;
  triggeredBy: 'TIMEOUT' | 'QUORUM' | 'UNANIMITY' | 'MANUAL';
}

@Injectable()
export class VotingSchedulerService {
  private readonly logger = new Logger(VotingSchedulerService.name);
  private timeouts = new Map<string, NodeJS.Timeout>(); // votingId -> timeout

  constructor(
    private prisma: PrismaService,
    private votingNotificationService: VotingNotificationService,
    private votingStatsService: VotingStatsService,
    private votingQuorumService: VotingQuorumService
  ) {}

  async scheduleVotingTimeout(votingId: string, endDate: Date): Promise<void> {
    try {
      // Clear existing timeout if any
      this.clearTimeout(votingId);

      const now = new Date();
      const timeUntilEnd = endDate.getTime() - now.getTime();

      if (timeUntilEnd <= 0) {
        // Already expired, close immediately
        await this.autoCloseVoting(votingId, 'TIMEOUT');
        return;
      }

      // Schedule timeout
      const timeout = setTimeout(async () => {
        try {
          await this.autoCloseVoting(votingId, 'TIMEOUT');
        } catch (error) {
          this.logger.error(`Error auto-closing voting ${votingId} on timeout:`, error);
        }
      }, timeUntilEnd);

      this.timeouts.set(votingId, timeout);
      
      this.logger.log(`Scheduled timeout for voting ${votingId} in ${Math.round(timeUntilEnd / 1000 / 60)} minutes`);

      // Schedule reminder notifications
      await this.scheduleReminders(votingId, endDate);
    } catch (error) {
      this.logger.error(`Error scheduling timeout for voting ${votingId}:`, error);
    }
  }

  async autoCloseVotingIfNeeded(votingId: string, triggeredByUserId?: string): Promise<AutoCloseResult> {
    try {
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
        return {
          closed: false,
          reason: 'Voting not found',
          triggeredBy: 'MANUAL'
        };
      }

      const now = new Date();
      const endDate = new Date(voting.endDate);
      const hasExpired = endDate <= now;

      // Check if voting should be auto-closed
      if (hasExpired) {
        return await this.autoCloseVoting(votingId, 'TIMEOUT', triggeredByUserId);
      }

      // Check for early closure conditions
      const quorumStatus = await this.votingQuorumService.checkQuorumStatus(votingId);
      
      // Auto-close if unanimity is achieved and it's a unanimity voting
      if (voting.type === 'UNANIMITY' && quorumStatus.quorumMet) {
        const stats = await this.votingStatsService.getRealTimeStats(votingId);
        const allProposalsPassed = stats.proposals.every(p => p.passed);
        
        if (allProposalsPassed) {
          return await this.autoCloseVoting(votingId, 'UNANIMITY', triggeredByUserId);
        }
      }

      // Check if it's impossible to reach quorum (all eligible voters have voted)
      const eligibleVoters = voting.assembly.house.users.length;
      const totalVotes = voting.votes.length;
      
      if (totalVotes === eligibleVoters) {
        return await this.autoCloseVoting(votingId, 'QUORUM', triggeredByUserId);
      }

      return {
        closed: false,
        reason: 'Auto-close conditions not met',
        triggeredBy: 'MANUAL'
      };
    } catch (error) {
      this.logger.error(`Error checking auto-close conditions for voting ${votingId}:`, error);
      return {
        closed: false,
        reason: `Error: ${error.message}`,
        triggeredBy: 'MANUAL'
      };
    }
  }

  private async autoCloseVoting(votingId: string, reason: 'TIMEOUT' | 'QUORUM' | 'UNANIMITY', triggeredByUserId?: string): Promise<AutoCloseResult> {
    try {
      // Clear any existing timeout
      this.clearTimeout(votingId);

      // Get final results before closing
      const finalResults = await this.votingStatsService.getRealTimeStats(votingId);

      // Here you would update the voting status in the database if you had a status field
      // For now, we'll just emit the events

      // Notify about the auto-closure
      if (reason === 'TIMEOUT') {
        await this.votingNotificationService.notifyVotingTimeout({
          votingId,
          triggeredBy: triggeredByUserId,
          timestamp: new Date(),
          reason: 'Voting period has ended'
        });
      } else {
        await this.votingNotificationService.notifyVotingAutoClosed({
          votingId,
          triggeredBy: triggeredByUserId,
          timestamp: new Date(),
          reason: reason === 'UNANIMITY' ? 'Unanimity achieved' : 'All eligible voters have participated',
          finalResults,
          closedBy: 'AUTO_CLOSE'
        });
      }

      this.logger.log(`Auto-closed voting ${votingId} due to ${reason}`);

      return {
        closed: true,
        reason: this.getCloseReasonMessage(reason),
        finalResults,
        triggeredBy: reason
      };
    } catch (error) {
      this.logger.error(`Error auto-closing voting ${votingId}:`, error);
      return {
        closed: false,
        reason: `Error closing voting: ${error.message}`,
        triggeredBy: reason
      };
    }
  }

  private async scheduleReminders(votingId: string, endDate: Date): Promise<void> {
    const now = new Date();
    const timeUntilEnd = endDate.getTime() - now.getTime();

    // Schedule reminder 24 hours before
    const reminderTime24h = timeUntilEnd - (24 * 60 * 60 * 1000);
    if (reminderTime24h > 0) {
      setTimeout(async () => {
        await this.sendReminderIfNeeded(votingId, 24);
      }, reminderTime24h);
    }

    // Schedule reminder 2 hours before
    const reminderTime2h = timeUntilEnd - (2 * 60 * 60 * 1000);
    if (reminderTime2h > 0) {
      setTimeout(async () => {
        await this.sendReminderIfNeeded(votingId, 2);
      }, reminderTime2h);
    }

    // Schedule reminder 30 minutes before
    const reminderTime30m = timeUntilEnd - (30 * 60 * 1000);
    if (reminderTime30m > 0) {
      setTimeout(async () => {
        await this.sendReminderIfNeeded(votingId, 0.5);
      }, reminderTime30m);
    }
  }

  private async sendReminderIfNeeded(votingId: string, hoursRemaining: number): Promise<void> {
    try {
      // Check if voting is still active before sending reminder
      const quorumStatus = await this.votingQuorumService.checkQuorumStatus(votingId);
      
      if (quorumStatus.timeRemaining && quorumStatus.timeRemaining > 0) {
        await this.votingNotificationService.sendReminder(votingId);
        
        if (hoursRemaining <= 2) {
          await this.votingNotificationService.notifyUrgentDeadline(votingId, hoursRemaining);
        }

        this.logger.log(`Sent reminder for voting ${votingId} (${hoursRemaining}h remaining)`);
      }
    } catch (error) {
      this.logger.error(`Error sending reminder for voting ${votingId}:`, error);
    }
  }

  private clearTimeout(votingId: string): void {
    const existingTimeout = this.timeouts.get(votingId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.timeouts.delete(votingId);
      this.logger.debug(`Cleared timeout for voting ${votingId}`);
    }
  }

  private getCloseReasonMessage(reason: string): string {
    switch (reason) {
      case 'TIMEOUT':
        return 'Voting period has ended';
      case 'UNANIMITY':
        return 'Unanimity has been achieved';
      case 'QUORUM':
        return 'All eligible voters have participated';
      default:
        return 'Voting has been closed';
    }
  }

  async cancelScheduledTimeout(votingId: string): Promise<void> {
    this.clearTimeout(votingId);
    this.logger.log(`Cancelled scheduled timeout for voting ${votingId}`);
  }

  getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys());
  }

  async checkParticipationAndNotify(votingId: string): Promise<void> {
    try {
      const stats = await this.votingStatsService.getRealTimeStats(votingId);
      
      // Check for low participation
      if (stats.turnoutPercentage < 30) {
        await this.votingNotificationService.notifyLowParticipation(votingId, stats.turnoutPercentage);
      }

      // Check for urgent deadline
      if (stats.timeRemaining) {
        const hoursRemaining = stats.timeRemaining / (1000 * 60 * 60);
        if (hoursRemaining <= 2 && hoursRemaining > 0) {
          await this.votingNotificationService.notifyUrgentDeadline(votingId, hoursRemaining);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking participation for voting ${votingId}:`, error);
    }
  }
}
