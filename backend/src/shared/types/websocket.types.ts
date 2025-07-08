// Basic WebSocket event types
export interface WebSocketUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

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
  'user-connected': (user: WebSocketUser) => void;
  'user-disconnected': (userId: string) => void;
  
  // Basic ping/pong for health check
  'ping': () => void;
  'pong': () => void;
  
  // Error events
  'error': (error: { message: string; code?: string }) => void;
  'auth-error': (error: { message: string }) => void;
}

// Connection status
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

// Basic server response structure
export interface WebSocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  timestamp: string;
}

// Voting WebSocket Events
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

// Voting data interfaces
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

// Room management
export interface VotingRoom {
  votingId: string;
  participants: Set<string>; // socket IDs
  userIds: Set<string>; // user IDs
  createdAt: Date;
  lastActivity: Date;
}

export interface VotingRoomStats {
  votingId: string;
  participantsCount: number;
  activeUsers: string[]; // user IDs
  lastActivity: Date;
}

export interface WebSocketConfig {
  cors: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
  transports: string[];
}
