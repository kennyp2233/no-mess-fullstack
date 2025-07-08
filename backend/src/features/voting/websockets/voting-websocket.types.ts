export interface VotingRoom {
    votingId: string;
    participants: Set<string>; // Socket IDs
    participantsCount: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface VotingParticipant {
    socketId: string;
    userId: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
    joinedAt: Date;
}

export interface CastVoteData {
    votingId: string;
    proposalId: string;
    vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    comment?: string;
}

export interface VotingInfo {
    id: string;
    title: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    proposals: VotingProposal[];
    startDate?: Date;
    endDate?: Date;
}

export interface VotingProposal {
    id: string;
    title: string;
    description?: string;
    order: number;
}

export interface VoteStats {
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
}

// WebSocket Event Types
export interface VotingEvents {
    // Client to Server
    join_voting: { votingId: string };
    leave_voting: { votingId: string };
    cast_vote: CastVoteData;
    get_voting_stats: { votingId: string };
    get_voting_rooms: void;

    // Server to Client
    voting_joined: {
        success: boolean;
        votingId: string;
        votingInfo: VotingInfo;
        participantsCount: number;
        message: string;
        timestamp: string;
    };

    voting_left: {
        success: boolean;
        votingId: string;
        message: string;
        timestamp: string;
    };

    vote_cast: {
        success: boolean;
        votingId: string;
        proposalId: string;
        vote: string;
        userId: string;
        userName: string;
        comment?: string;
        timestamp: string;
    };

    voting_update: {
        votingId: string;
        type: 'VOTE_CAST' | 'VOTE_CHANGED' | 'VOTING_STARTED' | 'VOTING_ENDED';
        data: any;
        timestamp: string;
    };

    voting_stats_update: VoteStats & { timestamp: string };

    participant_joined: {
        votingId: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
        timestamp: string;
    };

    participant_left: {
        votingId: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
        timestamp: string;
    };

    voting_error: {
        success: false;
        error: { message: string };
        timestamp: string;
    };

    voting_rooms_info: {
        success: boolean;
        data: {
            allRooms: VotingRoom[];
            userRooms: string[];
            totalRooms: number;
        };
        timestamp: string;
    };
}
