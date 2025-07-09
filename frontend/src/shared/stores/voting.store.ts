import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { 
  VotingInfo, 
  VotingStatsData, 
  VoteCastData, 
  ParticipantData,
  VotingUpdateData 
} from '../types/websocket.types';
import { websocketService } from '../services/websocket.service';

interface VotingState {
  activeVoting: VotingInfo | null;
  currentVote: {
    proposalId: string;
    vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    comment?: string;
  } | null;
  participants: ParticipantData[];
  stats: VotingStatsData | null;
  isInVotingRoom: boolean;
  lastUpdate: Date | null;
}

const initialState: VotingState = {
  activeVoting: null,
  currentVote: null,
  participants: [],
  stats: null,
  isInVotingRoom: false,
  lastUpdate: null,
};

function createVotingStore() {
  const { subscribe, set, update } = writable<VotingState>(initialState);

  // Set up WebSocket event listeners for voting events
  if (browser) {
    // Voting room events
    websocketService.on('voting_joined', (data) => {
      update(state => ({
        ...state,
        activeVoting: data.votingInfo,
        isInVotingRoom: true,
        lastUpdate: new Date(),
      }));
    });

    websocketService.on('voting_left', (data) => {
      update(state => ({
        ...state,
        activeVoting: null,
        isInVotingRoom: false,
        currentVote: null,
        participants: [],
        stats: null,
        lastUpdate: new Date(),
      }));
    });

    // Voting updates
    websocketService.on('voting_update', (data: VotingUpdateData) => {
      update(state => ({
        ...state,
        lastUpdate: new Date(),
      }));
    });

    websocketService.on('voting_stats_update', (data: VotingStatsData) => {
      update(state => ({
        ...state,
        stats: data,
        lastUpdate: new Date(),
      }));
    });

    // Vote cast events
    websocketService.on('vote_cast', (data: VoteCastData) => {
      update(state => ({
        ...state,
        lastUpdate: new Date(),
      }));
    });

    // Participant events
    websocketService.on('participant_joined', (data: ParticipantData) => {
      update(state => ({
        ...state,
        participants: [...state.participants, data],
        lastUpdate: new Date(),
      }));
    });

    websocketService.on('participant_left', (data: ParticipantData) => {
      update(state => ({
        ...state,
        participants: state.participants.filter(p => p.user.id !== data.user.id),
        lastUpdate: new Date(),
      }));
    });
  }

  return {
    subscribe,

    // Join a voting room
    joinVoting(votingId: string) {
      if (websocketService.isConnected()) {
        websocketService.emit('join_voting', { votingId });
      }
    },

    // Leave current voting room
    leaveVoting() {
      if (websocketService.isConnected() && this.getActiveVoting()) {
        websocketService.emit('leave_voting', { 
          votingId: this.getActiveVoting()!.id 
        });
      }
    },

    // Cast a vote
    castVote(proposalId: string, vote: 'APPROVE' | 'REJECT' | 'ABSTAIN', comment?: string) {
      if (websocketService.isConnected() && this.getActiveVoting()) {
        const votingId = this.getActiveVoting()!.id;
        websocketService.emit('cast_vote', {
          votingId,
          proposalId,
          vote,
          comment,
        });

        // Update local state
        update(state => ({
          ...state,
          currentVote: { proposalId, vote, comment },
        }));
      }
    },

    // Get active voting
    getActiveVoting(): VotingInfo | null {
      let currentState: VotingState = initialState;
      votingStore.subscribe(state => {
        currentState = state;
      })();
      return currentState?.activeVoting || null;
    },

    // Get current vote
    getCurrentVote() {
      let currentState: VotingState = initialState;
      votingStore.subscribe(state => {
        currentState = state;
      })();
      return currentState?.currentVote || null;
    },

    // Get voting stats
    getVotingStats(): VotingStatsData | null {
      let currentState: VotingState = initialState;
      votingStore.subscribe(state => {
        currentState = state;
      })();
      return currentState?.stats || null;
    },

    // Get participants
    getParticipants(): ParticipantData[] {
      let currentState: VotingState = initialState;
      votingStore.subscribe(state => {
        currentState = state;
      })();
      return currentState?.participants || [];
    },

    // Check if in voting room
    isInVotingRoom(): boolean {
      let currentState: VotingState = initialState;
      votingStore.subscribe(state => {
        currentState = state;
      })();
      return currentState?.isInVotingRoom || false;
    },

    // Clear voting state
    clear() {
      set(initialState);
    },
  };
}

export const votingStore = createVotingStore();

// Derived stores for specific voting states
export const activeVoting = derived(votingStore, $store => $store.activeVoting);
export const votingStats = derived(votingStore, $store => $store.stats);
export const votingParticipants = derived(votingStore, $store => $store.participants);
export const isInVotingRoom = derived(votingStore, $store => $store.isInVotingRoom);
export const currentVote = derived(votingStore, $store => $store.currentVote);
export const votingLastUpdate = derived(votingStore, $store => $store.lastUpdate); 