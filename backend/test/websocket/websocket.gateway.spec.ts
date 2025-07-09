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

describe('AppWebSocketGateway', () => {
    let gateway: AppWebSocketGateway;
    let webSocketService: WebSocketService;
    let jwtService: JwtService;
    let prismaService: PrismaService;

    const mockUser = WebSocketTestDataFactory.createMockUser();
    const mockToken = WebSocketTestDataFactory.createMockToken();

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

    describe('Connection Management', () => {
        it('should handle successful connection with valid token', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: 'test-socket-id',
                handshake: {
                    auth: { token: mockToken },
                    headers: {},
                    query: {},
                },
            });

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: mockSocket.id,
                userId: mockUser.id,
                user: mockUser,
                connectedAt: new Date(),
            });
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(undefined);

            // Act
            await gateway.handleConnection(mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('user_connected', expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    socketId: mockSocket.id,
                    user: mockUser,
                }),
            }));
            expect(webSocketService.addConnection).toHaveBeenCalledWith(mockSocket, mockUser);
        });

        it('should handle connection without token', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: {},
                    headers: {},
                    query: {},
                },
            });

            // Act
            await gateway.handleConnection(mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'AUTH_TOKEN_MISSING',
                }),
            }));
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        it('should handle connection with invalid token', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
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

        it('should handle reconnection for existing user', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                id: 'new-socket-id',
                handshake: {
                    auth: { token: mockToken },
                    headers: {},
                    query: {},
                },
            });

            const existingConnection = {
                id: 'old-socket-id',
                userId: mockUser.id,
                user: mockUser,
                connectedAt: new Date(),
            };

            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });
            jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
            jest.spyOn(webSocketService, 'getConnectionByUserId').mockReturnValue(existingConnection);
            jest.spyOn(webSocketService, 'getUserVotingRooms').mockReturnValue(['voting-1', 'voting-2']);
            jest.spyOn(webSocketService, 'addConnection').mockReturnValue({
                id: mockSocket.id,
                userId: mockUser.id,
                user: mockUser,
                connectedAt: new Date(),
            });

            // Act
            await gateway.handleConnection(mockSocket);

            // Assert
            expect(webSocketService.removeConnection).toHaveBeenCalledWith('old-socket-id');
            expect(webSocketService.joinVotingRoom).toHaveBeenCalledWith('new-socket-id', 'voting-1');
            expect(webSocketService.joinVotingRoom).toHaveBeenCalledWith('new-socket-id', 'voting-2');
        });

        it('should handle disconnect', () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();
            const connection = {
                id: mockSocket.id,
                userId: mockUser.id,
                user: mockUser,
                connectedAt: new Date(),
            };

            jest.spyOn(webSocketService, 'getConnection').mockReturnValue(connection);

            // Act
            gateway.handleDisconnect(mockSocket);

            // Assert
            expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user_disconnected', expect.objectContaining({
                success: true,
                data: { userId: mockUser.id },
            }));
            expect(webSocketService.removeConnection).toHaveBeenCalledWith(mockSocket.id);
        });
    });

    describe('Message Handling', () => {
        it('should handle test message successfully', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();
            const testData = WebSocketTestDataFactory.createTestMessage();

            // Act
            await gateway.handleTestMessage(testData, mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('message_response', expect.objectContaining({
                success: true,
                message: 'Test message received successfully',
                receivedData: testData,
            }));
        });

        it('should handle test message with invalid data', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();

            // Act
            await gateway.handleTestMessage(null, mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('validation_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'INVALID_DATA_FORMAT',
                }),
            }));
        });

        it('should handle rate limit exceeded', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();
            
            // Simulate rate limit exceeded by calling the method multiple times
            for (let i = 0; i < 11; i++) {
                await gateway.handleTestMessage({ message: `test ${i}` }, mockSocket);
            }

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('rate_limit_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'RATE_LIMIT_EXCEEDED',
                }),
            }));
        });

        it('should handle pong message', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();
            jest.spyOn(webSocketService, 'handlePong');

            // Act
            await gateway.handlePong(mockSocket);

            // Assert
            expect(webSocketService.handlePong).toHaveBeenCalledWith(mockSocket.id);
        });
    });

    describe('Error Handling', () => {
        it('should handle connection error gracefully', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: { token: mockToken },
                    headers: {},
                    query: {},
                },
            });

            // El gateway responde con 'auth_error' si el token es inválido
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

        it('should handle test message error gracefully', async () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket();
            const testData = WebSocketTestDataFactory.createTestMessage();

            // Forzar un error en el handler
            jest.spyOn(gateway as any, 'validateTestMessageData').mockImplementation(() => { throw new Error('Service error'); });

            // Act
            await gateway.handleTestMessage(testData, mockSocket);

            // Assert
            expect(mockSocket.emit).toHaveBeenCalledWith('connection_error', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'INTERNAL_ERROR',
                }),
            }));
        });
    });

    describe('Token Extraction', () => {
        it('should extract token from auth object', () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: { token: mockToken },
                    headers: {},
                    query: {},
                },
            });

            // Act
            const result = (gateway as any).extractTokenFromHandshake(mockSocket);

            // Assert
            expect(result).toBe(mockToken);
        });

        it('should extract token from authorization header', () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: {},
                    headers: { authorization: `Bearer ${mockToken}` },
                    query: {},
                },
            });

            // Act
            const result = (gateway as any).extractTokenFromHandshake(mockSocket);

            // Assert
            expect(result).toBe(mockToken);
        });

        it('should extract token from query parameters', () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: {},
                    headers: {},
                    query: { token: mockToken },
                },
            });

            // Act
            const result = (gateway as any).extractTokenFromHandshake(mockSocket);

            // Assert
            expect(result).toBe(mockToken);
        });

        it('should return null when no token found', () => {
            // Arrange
            const mockSocket = WebSocketTestUtils.createMockSocket({
                handshake: {
                    auth: {},
                    headers: {},
                    query: {},
                },
            });

            // Act
            const result = (gateway as any).extractTokenFromHandshake(mockSocket);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('Gateway Initialization', () => {
        it('should initialize gateway successfully', () => {
            // Arrange
            const mockServer = WebSocketTestUtils.createMockServer();
            jest.spyOn(webSocketService, 'setServer');

            // Act
            gateway.afterInit(mockServer as any);

            // Assert
            expect(webSocketService.setServer).toHaveBeenCalledWith(mockServer);
        });

        it('should handle initialization error gracefully', () => {
            // Arrange
            const mockServer = WebSocketTestUtils.createMockServer();
            jest.spyOn(webSocketService, 'setServer').mockImplementation(() => {
                throw new Error('Initialization failed');
            });

            // Act & Assert
            expect(() => gateway.afterInit(mockServer as any)).not.toThrow();
        });
    });
}); 