import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { VotingWebSocketService } from '../websockets/voting-websocket.service';
import { VotingStatsService, RealTimeStatsResponse } from './voting-stats.service';
import { VotingQuorumService, QuorumStatusResponse } from './voting-quorum.service';

export interface VotingEventData {
  votingId: string;
  triggeredBy?: string;
  timestamp: Date;
  reason?: string;
}

export interface VotingUpdateEventData extends VotingEventData {
  vote: {
    userId: string;
    option: string;
    comment?: string;
  };
  stats: RealTimeStatsResponse;
}

export interface QuorumEventData extends VotingEventData {
  quorumStatus: QuorumStatusResponse;
}

export interface VotingClosedEventData extends VotingEventData {
  finalResults: any;
  closedBy: 'USER' | 'AUTO_CLOSE' | 'TIMEOUT';
}

@Injectable()
export class VotingNotificationService {
  constructor(
    @Inject(forwardRef(() => VotingWebSocketService))
    private votingWebSocketService: VotingWebSocketService,
    private votingStatsService: VotingStatsService,
    private votingQuorumService: VotingQuorumService
  ) {}

  async notifyVotingUpdate(eventData: VotingUpdateEventData): Promise<void> {
    try {
      // Emitir evento de actualización de votación
      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'voting_update',
        {
          type: 'vote_cast',
          votingId: eventData.votingId,
          vote: eventData.vote,
          timestamp: eventData.timestamp,
          triggeredBy: eventData.triggeredBy
        }
      );

      // Emitir estadísticas actualizadas
      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'voting_stats_update',
        {
          type: 'stats_update',
          votingId: eventData.votingId,
          stats: eventData.stats,
          timestamp: eventData.timestamp
        }
      );

      console.log(`✅ Voting update notifications sent for voting ${eventData.votingId}`);
    } catch (error) {
      console.error(`❌ Error sending voting update notifications:`, error);
    }
  }

  async notifyQuorumReached(eventData: QuorumEventData): Promise<void> {
    try {
      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'quorum_reached',
        {
          type: 'quorum_reached',
          votingId: eventData.votingId,
          quorumStatus: eventData.quorumStatus,
          timestamp: eventData.timestamp,
          message: `Quorum of ${eventData.quorumStatus.requiredQuorum}% has been reached!`
        }
      );

      console.log(`✅ Quorum reached notification sent for voting ${eventData.votingId}`);
    } catch (error) {
      console.error(`❌ Error sending quorum reached notification:`, error);
    }
  }

  async notifyVotingClosed(eventData: VotingClosedEventData): Promise<void> {
    try {
      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'voting_closed',
        {
          type: 'voting_closed',
          votingId: eventData.votingId,
          finalResults: eventData.finalResults,
          closedBy: eventData.closedBy,
          timestamp: eventData.timestamp,
          reason: eventData.reason,
          triggeredBy: eventData.triggeredBy
        }
      );

      console.log(`✅ Voting closed notification sent for voting ${eventData.votingId}`);
    } catch (error) {
      console.error(`❌ Error sending voting closed notification:`, error);
    }
  }

  async notifyVotingAutoClosed(eventData: VotingClosedEventData): Promise<void> {
    try {
      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'voting_auto_closed',
        {
          type: 'voting_auto_closed',
          votingId: eventData.votingId,
          finalResults: eventData.finalResults,
          timestamp: eventData.timestamp,
          reason: eventData.reason || 'Voting automatically closed due to conditions met'
        }
      );

      console.log(`✅ Voting auto-closed notification sent for voting ${eventData.votingId}`);
    } catch (error) {
      console.error(`❌ Error sending voting auto-closed notification:`, error);
    }
  }

  async notifyVotingTimeout(eventData: VotingEventData): Promise<void> {
    try {
      const finalResults = await this.votingStatsService.getRealTimeStats(eventData.votingId);

      this.votingWebSocketService.broadcastToVotingRoom(
        eventData.votingId,
        'voting_timeout',
        {
          type: 'voting_timeout',
          votingId: eventData.votingId,
          finalResults,
          timestamp: eventData.timestamp,
          message: 'Voting has timed out and been automatically closed'
        }
      );

      console.log(`✅ Voting timeout notification sent for voting ${eventData.votingId}`);
    } catch (error) {
      console.error(`❌ Error sending voting timeout notification:`, error);
    }
  }

  async notifyEligibleVoters(votingId: string, eventType: string, data: any): Promise<void> {
    try {
      // Obtener participantes elegibles que no han votado
      const participants = await this.votingStatsService.getVotingParticipants(votingId);
      const eligibleUserIds = participants.participants.notVoted.map(p => p.userId);

      if (eligibleUserIds.length > 0) {
        // Por ahora, emitir a toda la sala con información de audiencia específica
        this.votingWebSocketService.broadcastToVotingRoom(
          votingId,
          eventType,
          {
            ...data,
            targetAudience: 'eligible_voters',
            remainingVoters: eligibleUserIds.length,
            eligibleUserIds // Los clientes pueden filtrar si es relevante para ellos
          }
        );

        console.log(`✅ Notification sent to ${eligibleUserIds.length} eligible voters for event ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ Error sending notifications to eligible voters:`, error);
    }
  }

  async sendReminder(votingId: string, triggeredBy?: string): Promise<void> {
    try {
      const stats = await this.votingStatsService.getRealTimeStats(votingId);
      const quorumStatus = await this.votingQuorumService.checkQuorumStatus(votingId);

      // Enviar recordatorio a votantes que aún no han participado
      await this.notifyEligibleVoters(
        votingId,
        'voting_reminder',
        {
          type: 'voting_reminder',
          votingId,
          stats,
          quorumStatus,
          timestamp: new Date(),
          triggeredBy,
          message: 'Reminder: Please cast your vote before the deadline'
        }
      );

      // También emitir a la sala general
      this.votingWebSocketService.broadcastToVotingRoom(
        votingId,
        'voting_reminder',
        {
          type: 'voting_reminder',
          votingId,
          stats,
          quorumStatus,
          timestamp: new Date(),
          triggeredBy,
          message: 'Voting reminder sent to all eligible voters'
        }
      );

      console.log(`✅ Voting reminder sent for voting ${votingId}`);
    } catch (error) {
      console.error(`❌ Error sending voting reminder:`, error);
    }
  }

  async notifyLowParticipation(votingId: string, currentTurnout: number): Promise<void> {
    try {
      if (currentTurnout < 30) { // Less than 30% participation
        const stats = await this.votingStatsService.getRealTimeStats(votingId);
        
        this.votingWebSocketService.broadcastToVotingRoom(
          votingId,
          'low_participation_warning',
          {
            type: 'low_participation_warning',
            votingId,
            currentTurnout,
            stats,
            timestamp: new Date(),
            message: `Low participation detected (${currentTurnout.toFixed(1)}%). Consider sending reminders.`
          }
        );

        console.log(`✅ Low participation warning sent for voting ${votingId} (${currentTurnout.toFixed(1)}%)`);
      }
    } catch (error) {
      console.error(`❌ Error sending low participation warning:`, error);
    }
  }

  async notifyUrgentDeadline(votingId: string, hoursRemaining: number): Promise<void> {
    try {
      if (hoursRemaining <= 2 && hoursRemaining > 0) { // Less than 2 hours remaining
        const stats = await this.votingStatsService.getRealTimeStats(votingId);
        const quorumStatus = await this.votingQuorumService.checkQuorumStatus(votingId);

        await this.notifyEligibleVoters(
          votingId,
          'urgent_deadline_warning',
          {
            type: 'urgent_deadline_warning',
            votingId,
            hoursRemaining,
            stats,
            quorumStatus,
            timestamp: new Date(),
            message: `Urgent: Only ${hoursRemaining} hours remaining to vote!`
          }
        );

        console.log(`✅ Urgent deadline warning sent for voting ${votingId} (${hoursRemaining}h remaining)`);
      }
    } catch (error) {
      console.error(`❌ Error sending urgent deadline warning:`, error);
    }
  }

  async broadcastSystemMessage(votingId: string, message: string, type: string = 'system_message'): Promise<void> {
    try {
      this.votingWebSocketService.broadcastToVotingRoom(
        votingId,
        type,
        {
          type,
          votingId,
          message,
          timestamp: new Date(),
          source: 'system'
        }
      );

      console.log(`✅ System message broadcasted to voting ${votingId}: ${message}`);
    } catch (error) {
      console.error(`❌ Error broadcasting system message:`, error);
    }
  }
}
