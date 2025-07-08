import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { VotingWebSocketService } from './voting-websocket.service';
import { WsAuthGuard } from '../../../shared/websockets/ws-auth.guard';
import { WsCurrentUser } from '../../../shared/websockets/ws-current-user.decorator';
import { CastVoteData, VotingInfo } from './voting-websocket.types';
import { WebSocketUser } from '../../../shared/types/websocket.types';
import { VotingService } from '../services/voting.service';

@UseGuards(WsAuthGuard)
@WebSocketGateway({
    namespace: '/voting',
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:4200'],
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
export class VotingWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(VotingWebSocketGateway.name);

    constructor(
        private votingWebSocketService: VotingWebSocketService,
        @Inject(forwardRef(() => VotingService))
        private votingService: VotingService,
    ) { }

    afterInit(server: Server) {
        this.votingWebSocketService.setServer(server);
        this.logger.log('Voting WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket) {
        // Authentication is handled by WsAuthGuard
        const user = client.data.user as WebSocketUser;
        if (user) {
            this.logger.log(`User ${user.email} connected to voting namespace (Socket: ${client.id})`);
        }
    }

    handleDisconnect(client: Socket) {
        const user = client.data.user as WebSocketUser;
        if (user) {
            this.logger.log(`User ${user.email} disconnected from voting namespace (Socket: ${client.id})`);
            
            // Get user's rooms before removing
            const userRooms = this.votingWebSocketService.getUserVotingRooms(user.id);
            
            // Leave all Socket.IO rooms
            for (const votingId of userRooms) {
                client.leave(`voting:${votingId}`);
            }
            
            // Remove from all voting rooms
            this.votingWebSocketService.removeFromAllVotingRooms(client.id);
        }
    }

    @SubscribeMessage('join_voting')
    async handleJoinVoting(
        @MessageBody() data: { votingId: string },
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            this.logger.log(`User ${user.email} attempting to join voting room ${data.votingId}`);

            if (!data.votingId) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID is required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Join the voting room
            const joined = this.votingWebSocketService.joinVotingRoom(client.id, user.id, data.votingId);

            if (joined) {
                // Join the Socket.IO room
                await client.join(`voting:${data.votingId}`);
                // Mock voting info (in real implementation, fetch from voting service)
                const mockVotingInfo: VotingInfo = {
                    id: data.votingId,
                    title: `Voting Session ${data.votingId}`,
                    description: 'Mock voting session for testing',
                    status: 'ACTIVE',
                    proposals: [
                        { id: 'prop1', title: 'Proposal 1', description: 'First proposal', order: 1 },
                        { id: 'prop2', title: 'Proposal 2', description: 'Second proposal', order: 2 },
                    ],
                };

                const roomStats = this.votingWebSocketService.getVotingRoomStats(data.votingId);

                // Notify the joining user
                client.emit('voting_joined', {
                    success: true,
                    votingId: data.votingId,
                    votingInfo: mockVotingInfo,
                    participantsCount: roomStats?.participantsCount || 1,
                    message: `Successfully joined voting room ${data.votingId}`,
                    timestamp: new Date().toISOString(),
                });

                // Notify other participants in the room
                this.votingWebSocketService.broadcastToVotingRoom(
                    data.votingId,
                    'participant_joined',
                    {
                        votingId: data.votingId,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                        },
                        timestamp: new Date().toISOString(),
                    },
                    client.id // exclude the joining user
                );

                this.logger.log(`User ${user.email} successfully joined voting room ${data.votingId}`);
            } else {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Failed to join voting room' },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error(`Error joining voting room: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: 'Internal error joining voting room' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('leave_voting')
    async handleLeaveVoting(
        @MessageBody() data: { votingId: string },
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            this.logger.log(`User ${user.email} attempting to leave voting room ${data.votingId}`);

            if (!data.votingId) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID is required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Leave the voting room
            const left = this.votingWebSocketService.leaveVotingRoom(client.id, data.votingId);

            if (left) {
                // Leave the Socket.IO room
                await client.leave(`voting:${data.votingId}`);
                // Notify the leaving user
                client.emit('voting_left', {
                    success: true,
                    votingId: data.votingId,
                    message: `Successfully left voting room ${data.votingId}`,
                    timestamp: new Date().toISOString(),
                });

                // Notify other participants in the room
                this.votingWebSocketService.broadcastToVotingRoom(
                    data.votingId,
                    'participant_left',
                    {
                        votingId: data.votingId,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                        },
                        timestamp: new Date().toISOString(),
                    }
                );

                this.logger.log(`User ${user.email} successfully left voting room ${data.votingId}`);
            } else {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Failed to leave voting room or not in room' },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error(`Error leaving voting room: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: 'Internal error leaving voting room' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('cast_vote')
    async handleCastVote(
        @MessageBody() data: CastVoteData,
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            this.logger.log(`User ${user.email} casting vote in ${data.votingId} for proposal ${data.proposalId}: ${data.vote}`);

            // Validate input
            if (!data.votingId || !data.proposalId || !data.vote) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID, proposal ID, and vote are required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            if (!['APPROVE', 'REJECT', 'ABSTAIN'].includes(data.vote)) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Invalid vote value. Must be APPROVE, REJECT, or ABSTAIN' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Check if user is in the voting room
            const isInRoom = this.votingWebSocketService.isUserInVotingRoom(user.id, data.votingId);
            if (!isInRoom) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'You must join the voting room before casting a vote' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Use real VotingService to cast vote and save to database
            const castVoteDto = {
                votingId: data.votingId,
                option: data.vote as any, // Convert to VoteOption enum
                comment: data.comment,
            };

            const vote = await this.votingService.castVote(castVoteDto, user.id);

            // Notify the voter of successful vote
            const voteData = {
                success: true,
                votingId: data.votingId,
                proposalId: data.proposalId,
                vote: data.vote,
                userId: user.id,
                userName: user.name,
                comment: data.comment,
                timestamp: new Date().toISOString(),
            };

            client.emit('vote_cast', voteData);

            this.logger.log(`Vote cast successfully by ${user.email} in voting ${data.votingId}`);

            // Note: The VotingService.castVote() method now handles:
            // - Broadcasting voting_update events
            // - Broadcasting voting_stats_update events  
            // - Saving vote to database
            // So we don't need to duplicate that logic here

        } catch (error) {
            this.logger.error(`Error casting vote: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: 'Internal error casting vote' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('get_voting_rooms')
    async handleGetVotingRooms(
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            const allRooms = this.votingWebSocketService.getAllVotingRooms();
            const userRooms = this.votingWebSocketService.getUserVotingRooms(user.id);

            client.emit('voting_rooms_info', {
                success: true,
                data: {
                    allRooms,
                    userRooms,
                    totalRooms: allRooms.length,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            this.logger.error(`Error getting voting rooms: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: 'Error retrieving voting rooms' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('get_voting_stats')
    async handleGetVotingStats(
        @MessageBody() data: { votingId: string },
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            if (!data.votingId) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID is required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            const roomStats = this.votingWebSocketService.getVotingRoomStats(data.votingId);

            if (!roomStats) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting room not found' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Mock stats (in real implementation, get from voting service)
            const mockStats = {
                votingId: data.votingId,
                totalVotes: Math.floor(Math.random() * 20) + 1,
                votesByProposal: {
                    prop1: {
                        approve: Math.floor(Math.random() * 8),
                        reject: Math.floor(Math.random() * 5),
                        abstain: Math.floor(Math.random() * 3),
                        total: Math.floor(Math.random() * 15) + 1,
                    },
                    prop2: {
                        approve: Math.floor(Math.random() * 6),
                        reject: Math.floor(Math.random() * 4),
                        abstain: Math.floor(Math.random() * 2),
                        total: Math.floor(Math.random() * 12) + 1,
                    },
                },
                participantsCount: roomStats.participantsCount,
                timestamp: new Date().toISOString(),
            };

            client.emit('voting_stats_update', mockStats);
        } catch (error) {
            this.logger.error(`Error getting voting stats: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: 'Error retrieving voting stats' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('close_voting')
    async handleCloseVoting(
        @MessageBody() data: { votingId: string },
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            this.logger.log(`User ${user.email} attempting to close voting ${data.votingId}`);

            if (!data.votingId) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID is required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Close voting and emit final results
            const result = await this.votingService.closeVoting(data.votingId, user.id);

            // Notify the requestor
            client.emit('voting_closed', {
                success: true,
                votingId: data.votingId,
                message: result.message,
                finalResults: result.finalResults,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Voting ${data.votingId} closed successfully by ${user.email}`);

        } catch (error) {
            this.logger.error(`Error closing voting: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: error.message || 'Error closing voting' },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('get_voting_results')
    async handleGetVotingResults(
        @MessageBody() data: { votingId: string },
        @ConnectedSocket() client: Socket,
        @WsCurrentUser() user: WebSocketUser,
    ): Promise<void> {
        try {
            this.logger.log(`User ${user.email} requesting results for voting ${data.votingId}`);

            if (!data.votingId) {
                client.emit('voting_error', {
                    success: false,
                    error: { message: 'Voting ID is required' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Get live voting stats
            const liveStats = await this.votingService.getRealTimeStats(data.votingId);

            client.emit('voting_results', {
                success: true,
                votingId: data.votingId,
                results: liveStats,
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            this.logger.error(`Error getting voting results: ${error.message}`);
            client.emit('voting_error', {
                success: false,
                error: { message: error.message || 'Error retrieving voting results' },
                timestamp: new Date().toISOString(),
            });
        }
    }
}
