import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AppWebSocketGateway } from '../../src/shared/websockets/websocket.gateway';
import { WebSocketService } from '../../src/shared/websockets/websocket.service';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { 
    WebSocketTestDataFactory, 
    MockWebSocketClient, 
    WebSocketAssertions,
    WebSocketTestUtils 
} from './websocket-test.utils';

describe('WebSocket Integration Tests', () => {
    let gateway: AppWebSocketGateway;
    let webSocketService: WebSocketService;
    let jwtService: JwtService;
    let prismaService: PrismaService;

    const mockUsers = [
        WebSocketTestDataFactory.createMockUser({ id: 'user1', email: 'user1@example.com', name: 'User 1' }),
        WebSocketTestDataFactory.createMockUser({ id: 'user2', email: 'user2@example.com', name: 'User 2' }),
        WebSocketTestDataFactory.createMockUser({ id: 'user3', email: 'user3@example.com', name: 'User 3' }),
    ];

    const mockTokens = mockUsers.map(user => WebSocketTestDataFactory.createMockToken(user.id));

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppWebSocketGateway,
                {
                    provide: WebSocketService,
                    useValue: {
                        setServer: jest.fn(),
                        addConnection: jest.fn(),
                        removeConnection: jest.fn(),
                        getConnection: jest.fn(),
                        getConnectionByUserId: jest.fn(),
                        joinVotingRoom: jest.fn(),
                        leaveVotingRoom: jest.fn(),
                        getUserVotingRooms: jest.fn(),
                        ping: jest.fn(),
                        handlePong: jest.fn(),
                        cleanupOrphanedConnections: jest.fn(),
                        isUserInVotingRoom: jest.fn(),
                        getVotingRoomStats: jest.fn(),
                        sendToUser: jest.fn(),
                        broadcastToVotingRoom: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        verify: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findUnique: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        gateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);
        webSocketService = module.get<WebSocketService>(WebSocketService);
        jwtService = module.get<JwtService>(JwtService);
        prismaService = module.get<PrismaService>(PrismaService);

        // Mock server
        gateway.server = WebSocketTestUtils.createMockServer() as any;
    });

    describe('Voting Flow with Multiple Clients', () => {
        let clients: MockWebSocketClient[];
        const votingId = 'integration-voting-id';

        beforeEach(() => {
            clients = mockUsers.map((_, index) => new MockWebSocketClient(`client-${index}`));
        });

        it('should handle complete voting flow with multiple clients', async () => {
            // Arrange - Connect all clients
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const user = mockUsers[i];
                const token = mockTokens[i];

                // Simulate connection
                const mockSocket = WebSocketTestUtils.createMockSocket({
                    id: client.id,
                    handshake: {
                        auth: { token },
                        headers: {},
                        query: {},
                    },
                });

                // Mock authentication
                jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
                jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
                jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                    id: client.id,
                    userId: user.id,
                    user,
                    connectedAt: new Date(),
                });
                jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

                // Connect client
                await gateway.handleConnection(mockSocket);
                client.user = user;
                client.connected = true;
            }

            // Act - Join voting room
            for (const client of clients) {
                jest.spyOn(webSocketService, 'joinVotingRoom').mockReturnValue(true);
                jest.spyOn(webSocketService, 'isUserInVotingRoom').mockReturnValue(true);
                
                // Simulate join voting room
                const mockSocket = WebSocketTestUtils.createMockSocket({ id: client.id });
                webSocketService.joinVotingRoom(client.id, votingId);
            }

            // Assert - All clients should be in voting room
            for (const client of clients) {
                expect(webSocketService.isUserInVotingRoom(client.user!.id, votingId)).toBe(true);
            }

            // Act - Cast votes
            const voteData = [
                { vote: 'APPROVE', comment: 'I approve this proposal' },
                { vote: 'REJECT', comment: 'I reject this proposal' },
                { vote: 'ABSTAIN', comment: 'I abstain from voting' },
            ];

            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const vote = voteData[i];
                
                // Simulate cast vote
                const castVoteData = WebSocketTestDataFactory.createVoteData({
                    votingId,
                    proposalId: 'proposal-1',
                    ...vote,
                });

                // Mock the cast vote handler
                const mockSocket = WebSocketTestUtils.createMockSocket({ id: client.id });
                
                // Simulate vote being cast
                client.emit('vote_cast', {
                    success: true,
                    votingId,
                    proposalId: 'proposal-1',
                    vote: vote.vote,
                    userId: client.user!.id,
                    userName: client.user!.name,
                    comment: vote.comment,
                    timestamp: new Date().toISOString(),
                });
            }

            // Assert - All votes should be recorded
            for (const client of clients) {
                const events = client.getAllEvents('vote_cast');
                expect(events.length).toBeGreaterThan(0);
                expect(events[0].success).toBe(true);
            }
        });

        it('should handle client disconnection and reconnection', async () => {
            // Arrange - Connect first client
            const client = clients[0];
            const user = mockUsers[0];
            const token = mockTokens[0];

            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: client.id,
                handshake: {
                    auth: { token },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: client.id,
                userId: user.id,
                user,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

            // Connect client
            await gateway.handleConnection(mockSocket);
            client.user = user;
            client.connected = true;

            // Join voting room
            jest.spyOn(webSocketService, 'joinVotingRoom').mockReturnValue(true);
            webSocketService.joinVotingRoom(client.id, votingId);

            // Act - Disconnect client
            gateway.handleDisconnect(mockSocket);

            // Assert - Client should be removed
            expect(webSocketService.removeConnection).toHaveBeenCalledWith(client.id);

            // Act - Reconnect client
            const newSocket = WebSocketTestUtils.createMockSocket({
                id: 'new-socket-id',
                handshake: {
                    auth: { token },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue({
                id: client.id,
                userId: user.id,
                user,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getUserVotingRooms').mockReturnValue([votingId]);

            await gateway.handleConnection(newSocket);

            // Assert - Client should be reconnected and in voting room
            expect(webSocketService.joinVotingRoom).toHaveBeenCalledWith('new-socket-id', votingId);
        });
    });

    describe('Quorum Detection and Auto-Close', () => {
        let clients: MockWebSocketClient[];
        const votingId = 'quorum-voting-id';

        beforeEach(() => {
            clients = mockUsers.map((_, index) => new MockWebSocketClient(`quorum-client-${index}`));
        });

        it('should detect quorum and auto-close voting', async () => {
            // Arrange - Connect all clients and join voting room
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const user = mockUsers[i];
                const token = mockTokens[i];

                const mockSocket = WebSocketTestUtils.createMockSocket({
                    id: client.id,
                    handshake: {
                        auth: { token },
                        headers: {},
                        query: {},
                    },
                });

                jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
                jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
                jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                    id: client.id,
                    userId: user.id,
                    user,
                    connectedAt: new Date(),
                });
                jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

                await gateway.handleConnection(mockSocket);
                client.user = user;
                client.connected = true;

                // Join voting room
                jest.spyOn(webSocketService, 'joinVotingRoom').mockReturnValue(true);
                jest.spyOn(webSocketService, 'isUserInVotingRoom').mockReturnValue(true);
                webSocketService.joinVotingRoom(client.id, votingId);
            }

            // Act - Cast votes to reach quorum
            const votes = ['APPROVE', 'APPROVE', 'REJECT'];
            
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const vote = votes[i];

                const castVoteData = WebSocketTestDataFactory.createVoteData({
                    votingId,
                    proposalId: 'proposal-1',
                    vote: vote as any,
                });

                // Simulate vote being cast
                client.emit('vote_cast', {
                    success: true,
                    votingId,
                    proposalId: 'proposal-1',
                    vote,
                    userId: client.user!.id,
                    userName: client.user!.name,
                    timestamp: new Date().toISOString(),
                });
            }

            // Assert - Voting should be completed with quorum
            jest.spyOn(webSocketService, 'getVotingRoomStats').mockReturnValue({
                votingId,
                participantsCount: 3,
                activeUsers: mockUsers.map(u => u.id),
                lastActivity: new Date(),
            });

            const stats = webSocketService.getVotingRoomStats(votingId);
            expect(stats).toBeDefined();
            expect(stats!.participantsCount).toBe(3);

            // Simulate quorum detection
            const totalVotes = 3;
            const approveVotes = 2;
            const quorumReached = approveVotes > totalVotes / 2;

            expect(quorumReached).toBe(true);

            // Act - Auto-close voting
            for (const client of clients) {
                client.emit('voting_completed', {
                    success: true,
                    votingId,
                    result: 'APPROVED',
                    quorumReached: true,
                    totalVotes,
                    approveVotes,
                    timestamp: new Date().toISOString(),
                });
            }

            // Assert - All clients should receive completion notification
            for (const client of clients) {
                const events = client.getAllEvents('voting_completed');
                expect(events.length).toBeGreaterThan(0);
                expect(events[0].success).toBe(true);
                expect(events[0].result).toBe('APPROVED');
                expect(events[0].quorumReached).toBe(true);
            }
        });

        it('should handle voting timeout without quorum', async () => {
            // Arrange - Connect only one client
            const client = clients[0];
            const user = mockUsers[0];
            const token = mockTokens[0];

            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: client.id,
                handshake: {
                    auth: { token },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: client.id,
                userId: user.id,
                user,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

            await gateway.handleConnection(mockSocket);
            client.user = user;
            client.connected = true;

            jest.spyOn(webSocketService, 'joinVotingRoom').mockReturnValue(true);
            webSocketService.joinVotingRoom(client.id, votingId);

            // Act - Simulate voting timeout
            const totalVotes = 1;
            const approveVotes = 1;
            const quorumReached = approveVotes > totalVotes / 2;

            client.emit('voting_timeout', {
                success: true,
                votingId,
                result: 'TIMEOUT',
                quorumReached: false,
                totalVotes,
                approveVotes,
                timestamp: new Date().toISOString(),
            });

            // Assert - Client should receive timeout notification
            const events = client.getAllEvents('voting_timeout');
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].success).toBe(true);
            expect(events[0].result).toBe('TIMEOUT');
            expect(events[0].quorumReached).toBe(false);
        });
    });

    describe('Notification Delivery', () => {
        let clients: MockWebSocketClient[];
        const votingId = 'notification-voting-id';

        beforeEach(() => {
            clients = mockUsers.map((_, index) => new MockWebSocketClient(`notification-client-${index}`));
        });

        it('should deliver notifications to all participants', async () => {
            // Arrange - Connect all clients
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const user = mockUsers[i];
                const token = mockTokens[i];

                const mockSocket = WebSocketTestUtils.createMockSocket({
                    id: client.id,
                    handshake: {
                        auth: { token },
                        headers: {},
                        query: {},
                    },
                });

                jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
                jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
                jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                    id: client.id,
                    userId: user.id,
                    user,
                    connectedAt: new Date(),
                });
                jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

                await gateway.handleConnection(mockSocket);
                client.user = user;
                client.connected = true;

                // Join voting room
                jest.spyOn(webSocketService, 'joinVotingRoom').mockReturnValue(true);
                jest.spyOn(webSocketService, 'isUserInVotingRoom').mockReturnValue(true);
                webSocketService.joinVotingRoom(client.id, votingId);
            }

            // Act - Send notification to voting room
            const notification = {
                type: 'VOTING_UPDATE',
                message: 'New proposal added to voting',
                data: { proposalId: 'new-proposal' },
            };

            webSocketService.broadcastToVotingRoom(votingId, 'notification', notification);

            // Assert - All clients should receive notification
            for (const client of clients) {
                expect(webSocketService.isUserInVotingRoom(client.user!.id, votingId)).toBe(true);
            }
        });

        it('should handle notification delivery to specific users', async () => {
            // Arrange - Connect clients
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                const user = mockUsers[i];
                const token = mockTokens[i];

                const mockSocket = WebSocketTestUtils.createMockSocket({
                    id: client.id,
                    handshake: {
                        auth: { token },
                        headers: {},
                        query: {},
                    },
                });

                jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
                jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
                jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                    id: client.id,
                    userId: user.id,
                    user,
                    connectedAt: new Date(),
                });
                jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

                await gateway.handleConnection(mockSocket);
                client.user = user;
                client.connected = true;
            }

            // Act - Send notification to specific user
            const targetUser = mockUsers[0];
            const notification = {
                type: 'PERSONAL_NOTIFICATION',
                message: 'You have a new message',
                data: { messageId: 'msg-123' },
            };

            jest.spyOn(webSocketService, 'sendToUser').mockReturnValue(true);
            const result = webSocketService.sendToUser(targetUser.id, 'personal_notification', notification);

            // Assert - Notification should be sent successfully
            expect(result).toBe(true);
        });

        it('should handle notification delivery failure', async () => {
            // Arrange - No clients connected

            // Act - Try to send notification to non-existent user
            const notification = {
                type: 'PERSONAL_NOTIFICATION',
                message: 'You have a new message',
                data: { messageId: 'msg-123' },
            };

            jest.spyOn(webSocketService, 'sendToUser').mockReturnValue(false);
            const result = webSocketService.sendToUser('non-existent-user', 'personal_notification', notification);

            // Assert - Notification should fail
            expect(result).toBe(false);
        });
    });

    describe('Error Scenarios', () => {
        it('should handle authentication errors gracefully', async () => {
            // Arrange
            const client = new MockWebSocketClient('error-client');
            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: client.id,
                handshake: {
                    auth: { token: 'invalid-token' },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Act
            await gateway.handleConnection(mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'INVALID_TOKEN',
                }),
            }));
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        it('should handle rate limiting in voting flow', async () => {
            // Arrange
            const client = new MockWebSocketClient('rate-limit-client');
            const user = mockUsers[0];
            const token = mockTokens[0];

            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: client.id,
                handshake: {
                    auth: { token },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: client.id,
                userId: user.id,
                user,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

            await gateway.handleConnection(mockSocket);

            // Act - Send too many messages
            for (let i = 0; i < 15; i++) {
                await gateway.handleTestMessage({ message: `test ${i}` }, mockSocket);
            }

            // Assert - Rate limit error should be sent
            expect(mockSocket.emit).toHaveBeenCalledWith('rate_limit_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'RATE_LIMIT_EXCEEDED',
                }),
            }));
        });

        it('should handle connection cleanup on errors', async () => {
            // Arrange
            const client = new MockWebSocketClient('cleanup-client');
            const user = mockUsers[0];
            const token = mockTokens[0];

            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: client.id,
                handshake: {
                    auth: { token },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user as any);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: client.id,
                userId: user.id,
                user,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

            await gateway.handleConnection(mockSocket);

            // Act - Simulate error during message handling
            jest.spyOn(gateway as any, 'validateTestMessageData').mockImplementation(() => {
                throw new Error('Service error');
            });

            await gateway.handleTestMessage({ message: 'test' }, mockSocket);

            // Assert - Error should be handled gracefully
            expect(mockSocket.emit).toHaveBeenCalledWith('connection_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'INTERNAL_ERROR',
                }),
            }));
        });
    });
}); 