import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketService } from '../../src/shared/websockets/websocket.service';
import { 
    WebSocketTestDataFactory, 
    MockWebSocketClient, 
    WebSocketAssertions,
    WebSocketTestUtils 
} from './websocket-test.utils';

describe('WebSocketService', () => {
    let service: WebSocketService;
    let mockServer: any;

    const mockUser = WebSocketTestDataFactory.createMockUser();
    const mockSocket = WebSocketTestUtils.createMockSocket();

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [WebSocketService],
        }).compile();

        service = module.get<WebSocketService>(WebSocketService);
        // Mock server con sockets válidos
        mockServer = WebSocketTestUtils.createMockServer();
        // Agregar el mockSocket al server para que joinVotingRoom funcione
        mockServer.sockets.sockets.set(mockSocket.id, mockSocket);
        service.setServer(mockServer);
    });

    describe('Connection Management', () => {
        it('should add connection successfully', () => {
            // Act
            const connection = service.addConnection(mockSocket, mockUser);

            // Assert
            expect(connection).toBeDefined();
            expect(connection.id).toBe(mockSocket.id);
            expect(connection.userId).toBe(mockUser.id);
            expect(connection.user).toEqual(mockUser);
            expect(service.getConnection(mockSocket.id)).toEqual(connection);
        });

        it('should remove connection successfully', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);

            // Act
            service.removeConnection(mockSocket.id);

            // Assert
            expect(service.getConnection(mockSocket.id)).toBeUndefined();
        });

        it('should get connection by user ID', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);

            // Act
            const connection = service.getConnectionByUserId(mockUser.id);

            // Assert
            expect(connection).toBeDefined();
            expect(connection!.userId).toBe(mockUser.id);
        });

        it('should check if user is connected', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);

            // Act & Assert
            expect(service.isUserConnected(mockUser.id)).toBe(true);
            expect(service.isUserConnected('non-existent-user')).toBe(false);
        });

        it('should get all connections', () => {
            // Arrange
            const user2 = WebSocketTestDataFactory.createMockUser({ id: 'user2', email: 'user2@example.com' });
            const socket2 = WebSocketTestUtils.createMockSocket({ id: 'socket2' });
            
            service.addConnection(mockSocket, mockUser);
            service.addConnection(socket2, user2);

            // Act
            const connections = service.getAllConnections();

            // Assert
            expect(connections).toHaveLength(2);
            expect(connections.map(c => c.userId)).toContain(mockUser.id);
            expect(connections.map(c => c.userId)).toContain(user2.id);
        });

        it('should get connected user IDs', () => {
            // Arrange
            const user2 = WebSocketTestDataFactory.createMockUser({ id: 'user2', email: 'user2@example.com' });
            const socket2 = WebSocketTestUtils.createMockSocket({ id: 'socket2' });
            
            service.addConnection(mockSocket, mockUser);
            service.addConnection(socket2, user2);

            // Act
            const userIds = service.getConnectedUserIds();

            // Assert
            expect(userIds).toHaveLength(2);
            expect(userIds).toContain(mockUser.id);
            expect(userIds).toContain(user2.id);
        });
    });

    describe('Voting Room Management', () => {
        const votingId = 'test-voting-id';

        beforeEach(() => {
            service.addConnection(mockSocket, mockUser);
        });

        it('should join voting room successfully', () => {
            // Act
            const result = service.joinVotingRoom(mockSocket.id, votingId);

            // Assert
            expect(result).toBe(true);
            expect(service.isUserInVotingRoom(mockUser.id, votingId)).toBe(true);
        });

        it('should fail to join voting room with invalid socket', () => {
            // Act
            const result = service.joinVotingRoom('invalid-socket-id', votingId);

            // Assert
            expect(result).toBe(false);
        });

        it('should leave voting room successfully', () => {
            // Arrange
            service.joinVotingRoom(mockSocket.id, votingId);

            // Act
            const result = service.leaveVotingRoom(mockSocket.id, votingId);

            // Assert
            expect(result).toBe(true);
            expect(service.isUserInVotingRoom(mockUser.id, votingId)).toBe(false);
        });

        it('should leave all voting rooms', () => {
            // Arrange
            service.joinVotingRoom(mockSocket.id, 'voting-1');
            service.joinVotingRoom(mockSocket.id, 'voting-2');

            // Act
            service.leaveAllVotingRooms(mockSocket.id);

            // Assert
            expect(service.isUserInVotingRoom(mockUser.id, 'voting-1')).toBe(false);
            expect(service.isUserInVotingRoom(mockUser.id, 'voting-2')).toBe(false);
        });

        it('should get user voting rooms', () => {
            // Arrange
            service.joinVotingRoom(mockSocket.id, 'voting-1');
            service.joinVotingRoom(mockSocket.id, 'voting-2');

            // Act
            const userRooms = service.getUserVotingRooms(mockUser.id);

            // Assert
            expect(userRooms).toHaveLength(2);
            expect(userRooms).toContain('voting-1');
            expect(userRooms).toContain('voting-2');
        });

        it('should get voting room stats', () => {
            // Arrange
            const user2 = WebSocketTestDataFactory.createMockUser({ id: 'user2', email: 'user2@example.com' });
            const socket2 = WebSocketTestUtils.createMockSocket({ id: 'socket2' });
            
            service.addConnection(socket2, user2);
            service.joinVotingRoom(mockSocket.id, votingId);
            service.joinVotingRoom(socket2.id, votingId);

            // Act
            const stats = service.getVotingRoomStats(votingId);

            // Assert
            expect(stats).toBeDefined();
            expect(stats!.participantsCount).toBe(2);
            expect(stats!.activeUsers).toContain(mockUser.id);
            expect(stats!.activeUsers).toContain(user2.id);
        });

        it('should get all voting rooms', () => {
            // Arrange
            service.joinVotingRoom(mockSocket.id, 'voting-1');
            service.joinVotingRoom(mockSocket.id, 'voting-2');

            // Act
            const allRooms = service.getAllVotingRooms();

            // Assert
            expect(allRooms).toHaveLength(2);
            expect(allRooms.map(r => r.votingId)).toContain('voting-1');
            expect(allRooms.map(r => r.votingId)).toContain('voting-2');
        });
    });

    describe('Health Monitoring', () => {
        beforeEach(() => {
            service.addConnection(mockSocket, mockUser);
        });

        it('should ping connection', () => {
            // Act
            service.ping(mockSocket.id);

            // Assert
            // The ping method should not throw and should update health tracking
            expect(() => service.ping(mockSocket.id)).not.toThrow();
        });

        it('should handle pong response', () => {
            // Arrange
            service.ping(mockSocket.id); // First ping

            // Act
            service.handlePong(mockSocket.id);

            // Assert
            // The pong handler should not throw
            expect(() => service.handlePong(mockSocket.id)).not.toThrow();
        });

        it('should cleanup orphaned connections', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);

            // Act
            service.cleanupOrphanedConnections();

            // Assert
            // The cleanup should not throw
            expect(() => service.cleanupOrphanedConnections()).not.toThrow();
        });
    });

    describe('Messaging', () => {
        beforeEach(() => {
            service.addConnection(mockSocket, mockUser);
        });

        it('should send to socket', () => {
            // Arrange
            const event = 'test-event';
            const data = { message: 'test' };

            // Act
            service.sendToSocket(mockSocket.id, event, data);

            // Assert
            // The method should not throw
            expect(() => service.sendToSocket(mockSocket.id, event, data)).not.toThrow();
        });

        it('should send to user', () => {
            // Arrange
            const event = 'test-event';
            const data = { message: 'test' };

            // Act
            const result = service.sendToUser(mockUser.id, event, data);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when sending to non-existent user', () => {
            // Arrange
            const event = 'test-event';
            const data = { message: 'test' };

            // Act
            const result = service.sendToUser('non-existent-user', event, data);

            // Assert
            expect(result).toBe(false);
        });

        it('should broadcast message', () => {
            // Arrange
            const event = 'test-event';
            const data = { message: 'test' };

            // Act
            service.broadcast(event, data);

            // Assert
            // The method should not throw
            expect(() => service.broadcast(event, data)).not.toThrow();
        });

        it('should send error', () => {
            // Arrange
            const error = { message: 'Test error', code: 'TEST_ERROR' };

            // Act
            service.sendError(mockSocket.id, error);

            // Assert
            // The method should not throw
            expect(() => service.sendError(mockSocket.id, error)).not.toThrow();
        });
    });

    describe('Reconnection Support', () => {
        it('should handle user reconnection', async () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);
            service.joinVotingRoom(mockSocket.id, 'voting-1');
            service.joinVotingRoom(mockSocket.id, 'voting-2');

            const newSocket = WebSocketTestUtils.createMockSocket({ id: 'new-socket-id' });
            service.addConnection(newSocket, mockUser);

            // Act
            const result = await service.handleUserReconnection(newSocket.id, mockUser.id);

            // Assert
            expect(result).toBe(true);
        });

        it('should fail reconnection with invalid socket', async () => {
            // Act
            const result = await service.handleUserReconnection('invalid-socket-id', mockUser.id);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('Connection Statistics', () => {
        it('should get connection stats', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);

            // Act
            const stats = service.getConnectionStats();

            // Assert
            expect(stats).toBeDefined();
            expect(stats.totalConnections).toBe(1);
            expect(stats.connectedUsers).toBe(1);
            expect(stats.connections).toHaveLength(1);
            expect(stats.connections[0].socketId).toBe(mockSocket.id);
            expect(stats.connections[0].userId).toBe(mockUser.id);
        });

        it('should handle stats error gracefully', () => {
            // Arrange
            service.addConnection(mockSocket, mockUser);
            
            // Mock an error in the stats calculation
            jest.spyOn(service, 'getAllConnections').mockImplementation(() => {
                throw new Error('Stats error');
            });

            // Act
            const stats = service.getConnectionStats();

            // Assert
            expect(stats).toBeDefined();
            expect(stats.totalConnections).toBe(0);
            expect(stats.connectedUsers).toBe(0);
            expect(stats.healthyConnections).toBe(0);
            expect(stats.connections).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully in connection management', () => {
            // Arrange
            jest.spyOn(service, 'getConnection').mockImplementation(() => {
                throw new Error('Connection error');
            });

            // Act & Assert
            expect(() => service.removeConnection(mockSocket.id)).not.toThrow();
        });

        it('should handle errors gracefully in voting room management', () => {
            // Arrange
            jest.spyOn(service, 'getConnection').mockImplementation(() => {
                throw new Error('Voting room error');
            });

            // Act & Assert
            expect(() => service.joinVotingRoom(mockSocket.id, 'voting-id')).not.toThrow();
            expect(() => service.leaveVotingRoom(mockSocket.id, 'voting-id')).not.toThrow();
        });

        it('should handle errors gracefully in messaging', () => {
            // Arrange
            jest.spyOn(service, 'getConnectionByUserId').mockImplementation(() => {
                throw new Error('Messaging error');
            });

            // Act & Assert
            expect(() => service.sendToUser(mockUser.id, 'test', {})).not.toThrow();
        });
    });

    describe('Broadcasting to Voting Rooms', () => {
        const votingId = 'test-voting-id';

        beforeEach(() => {
            service.addConnection(mockSocket, mockUser);
            service.joinVotingRoom(mockSocket.id, votingId);
        });

        it('should broadcast to voting room', () => {
            // Arrange
            const event = 'voting-update';
            const data = { votingId, status: 'ACTIVE' };

            // Act
            service.broadcastToVotingRoom(votingId, event, data);

            // Assert
            // The method should not throw
            expect(() => service.broadcastToVotingRoom(votingId, event, data)).not.toThrow();
        });

        it('should broadcast to voting room excluding socket', () => {
            // Arrange
            const event = 'voting-update';
            const data = { votingId, status: 'ACTIVE' };

            // Act
            service.broadcastToVotingRoom(votingId, event, data, mockSocket.id);

            // Assert
            // The method should not throw
            expect(() => service.broadcastToVotingRoom(votingId, event, data, mockSocket.id)).not.toThrow();
        });
    });
}); 