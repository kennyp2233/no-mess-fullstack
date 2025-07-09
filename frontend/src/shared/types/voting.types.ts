// Enums
export enum VotingType {
  SIMPLE_MAJORITY = 'SIMPLE_MAJORITY',
  QUALIFIED_MAJORITY = 'QUALIFIED_MAJORITY',
  UNANIMITY = 'UNANIMITY'
}

export enum VoteOption {
  YES = 'YES',
  NO = 'NO',
  ABSTAIN = 'ABSTAIN'
}

export enum AssemblyStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ProposalType {
  PROJECT_APPROVAL = 'PROJECT_APPROVAL',
  ALIQUOT_CHANGE = 'ALIQUOT_CHANGE',
  BUDGET_APPROVAL = 'BUDGET_APPROVAL',
  REGULATION_CHANGE = 'REGULATION_CHANGE',
  EXTRAORDINARY_FEE = 'EXTRAORDINARY_FEE',
  OTHER = 'OTHER'
}

export enum ProposalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

// Base interfaces
export interface Assembly {
  id: string;
  title: string;
  description?: string;
  date: string;
  location?: string;
  status: AssemblyStatus;
  houseId: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  house: House;
  votings: Voting[];
  minutes: Minutes[];
  proposals: Proposal[];
}

export interface Voting {
  id: string;
  title: string;
  description?: string;
  type: VotingType;
  startDate: string;
  endDate: string;
  requiredQuorum?: number;
  assemblyId: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  assembly: Assembly;
  votes: Vote[];
  proposals: Proposal[];
}

export interface Vote {
  id: string;
  option: VoteOption;
  comment?: string;
  userId: string;
  votingId: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  user: UserResponse;
  voting: Voting;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  status: ProposalStatus;
  userId: string;
  assemblyId?: string;
  votingId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  user: UserResponse;
  assembly?: Assembly;
  voting?: Voting;
  project?: Project;
}

export interface Minutes {
  id: string;
  title: string;
  content: string;
  attendees: string[];
  decisions: string[];
  status: MinutesStatus;
  assemblyId: string;
  secretaryId?: string;
  validatedBy?: string;
  validatedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  assembly: Assembly;
  secretary?: UserResponse;
  validator?: UserResponse;
}

export enum MinutesStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED'
}

// Request/Response interfaces
export interface CreateVotingRequest {
  title: string;
  description?: string;
  type: VotingType;
  startDate: string;
  endDate: string;
  requiredQuorum?: number;
  assemblyId: string;
}

export interface UpdateVotingRequest {
  title?: string;
  description?: string;
  type?: VotingType;
  startDate?: string;
  endDate?: string;
  requiredQuorum?: number;
}

export interface CastVoteRequest {
  option: VoteOption;
  comment?: string;
}

export interface CreateProposalRequest {
  title: string;
  description: string;
  proposalType: ProposalType;
  assemblyId?: string;
  votingId?: string;
  projectId?: string;
}

export interface UpdateProposalRequest {
  title?: string;
  description?: string;
  proposalType?: ProposalType;
  status?: ProposalStatus;
}

export interface CreateAssemblyRequest {
  title: string;
  description?: string;
  date: string;
  location?: string;
  houseId: string;
}

export interface UpdateAssemblyRequest {
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  status?: AssemblyStatus;
}

export interface CreateMinutesRequest {
  title: string;
  content: string;
  attendees: string[];
  decisions: string[];
  assemblyId: string;
}

export interface UpdateMinutesRequest {
  title?: string;
  content?: string;
  attendees?: string[];
  decisions?: string[];
  status?: MinutesStatus;
}

// Query interfaces
export interface VotingQuery {
  page?: number;
  limit?: number;
  assemblyId?: string;
  type?: VotingType;
  status?: 'active' | 'ended' | 'upcoming';
}

export interface AssemblyQuery {
  page?: number;
  limit?: number;
  houseId?: string;
  status?: AssemblyStatus;
  startDate?: string;
  endDate?: string;
}

export interface ProposalQuery {
  page?: number;
  limit?: number;
  assemblyId?: string;
  votingId?: string;
  proposalType?: ProposalType;
  status?: ProposalStatus;
}

// Voting statistics
export interface VotingStats {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  quorumMet: boolean;
  result: 'approved' | 'rejected' | 'pending';
}

// Import types from other files
import type { UserResponse } from './user.types';
import type { House } from './house.types';
import type { Project } from './transaction.types'; 