// WebSocket connection status
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

// WebSocket user interface
export interface WebSocketUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// WebSocket connection interface
export interface WebSocketConnection {
  id: string;
  userId: string;
  user: WebSocketUser;
  connectedAt: Date;
}

// Basic WebSocket events
export interface WebSocketEventMap {
  // Connection events
  'connect': () => void;
  'disconnect': () => void;
  'user_connected': (user: WebSocketUser) => void;
  'user_disconnected': (userId: string) => void;
  
  // Basic ping/pong for health check
  'ping': () => void;
  'pong': () => void;
  
  // Error events
  'error': (error: { message: string; code?: string }) => void;
  'auth_error': (error: { message: string; code?: string }) => void;
  'connection_error': (error: { message: string; code?: string }) => void;
  'rate_limit_error': (error: { message: string; code?: string }) => void;
  'validation_error': (error: { message: string; code?: string }) => void;
  
  // Voting events
  'voting_joined': (data: VotingJoinedData) => void;
  'voting_left': (data: VotingLeftData) => void;
  'voting_update': (data: VotingUpdateData) => void;
  'voting_stats_update': (data: VotingStatsData) => void;
  'vote_cast': (data: VoteCastData) => void;
  'participant_joined': (data: ParticipantData) => void;
  'participant_left': (data: ParticipantData) => void;
}

// Server response structure
export interface WebSocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  timestamp: string;
}

// Connection health monitoring
export interface ConnectionHealth {
  lastPing: Date;
  lastPong: Date | null;
  missedPings: number;
  isAlive: boolean;
}

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  authToken?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  heartbeatInterval?: number;
}

// Voting WebSocket Events (for future use)
export interface VotingEventMap {
  // Room management
  'join_voting': (data: JoinVotingData) => void;
  'leave_voting': (data: LeaveVotingData) => void;
  'voting_joined': (data: VotingJoinedData) => void;
  'voting_left': (data: VotingLeftData) => void;
  
  // Voting actions
  'cast_vote': (data: CastVoteData) => void;
  'vote_cast': (data: VoteCastData) => void;
  
  // Voting updates
  'voting_update': (data: VotingUpdateData) => void;
  'voting_stats_update': (data: VotingStatsData) => void;
  'participant_joined': (data: ParticipantData) => void;
  'participant_left': (data: ParticipantData) => void;
}

// Voting data interfaces (for future use)
export interface JoinVotingData {
  votingId: string;
}

export interface LeaveVotingData {
  votingId: string;
}

export interface VotingJoinedData {
  success: boolean;
  votingId: string;
  votingInfo: VotingInfo;
  participantsCount: number;
  userVote?: VoteData;
  message: string;
}

export interface VotingLeftData {
  success: boolean;
  votingId: string;
  message: string;
}

export interface CastVoteData {
  votingId: string;
  proposalId: string;
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  comment?: string;
}

export interface VoteCastData {
  success: boolean;
  votingId: string;
  proposalId: string;
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  userId: string;
  userName: string;
  comment?: string;
  timestamp: string;
}

export interface VotingUpdateData {
  votingId: string;
  type: 'STATUS_CHANGE' | 'TIME_UPDATE' | 'PROPOSAL_ADDED' | 'PROPOSAL_REMOVED';
  data: any;
  timestamp: string;
}

export interface VotingStatsData {
  votingId: string;
  totalVotes: number;
  votesByProposal: {
    [proposalId: string]: {
      approve: number;
      reject: number;
      abstain: number;
      total: number;
    };
  };
  participantsCount: number;
  timestamp: string;
}

export interface ParticipantData {
  votingId: string;
  user: WebSocketUser;
  timestamp: string;
}

export interface VotingInfo {
  id: string;
  title: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  proposals: ProposalInfo[];
}

export interface ProposalInfo {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface VoteData {
  proposalId: string;
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  comment?: string;
  timestamp: string;
} 