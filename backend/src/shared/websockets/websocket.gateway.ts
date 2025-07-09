import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards, BadRequestException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WebSocketService } from './websocket.service';
import { WsAuthGuard } from './ws-auth.guard';
import { WsCurrentUser } from './ws-current-user.decorator';
import { WebSocketUser } from '../types/websocket.types';
import { PrismaService } from '../database/prisma.service';

// Rate limiting configuration
interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

interface RateLimitInfo {
    requests: number;
    resetTime: number;
}

@WebSocketGateway({
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:4200'], // Frontend URLs
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
export class AppWebSocketGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AppWebSocketGateway.name);
    
    // Rate limiting storage
    private rateLimitMap = new Map<string, RateLimitInfo>();
    private readonly rateLimitConfig: RateLimitConfig = {
        maxRequests: 10, // 10 requests per window
        windowMs: 60000, // 1 minute window
    };

    constructor(
        private webSocketService: WebSocketService,
        private jwtService: JwtService,
        private prisma: PrismaService,
    ) { }

    // ===========================================
    // BASIC EVENTS
    // ===========================================

    @SubscribeMessage('test_message')
    async handleTestMessage(
        @MessageBody() data: any,
        @ConnectedSocket() client: Socket,
    ): Promise<void> {
        try {
            // Rate limiting check
            if (!this.checkRateLimit(client.id)) {
                this.logger.warn(`Rate limit exceeded for client ${client.id}`);
                client.emit('rate_limit_error', {
                    success: false,
                    error: { 
                        message: 'Rate limit exceeded. Please wait before sending more messages.',
                        code: 'RATE_LIMIT_EXCEEDED'
                    },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Validate input data
            if (!this.validateTestMessageData(data)) {
                this.logger.warn(`Invalid test message data from client ${client.id}:`, data);
                client.emit('validation_error', {
                    success: false,
                    error: { 
                        message: 'Invalid message format',
                        code: 'INVALID_DATA_FORMAT'
                    },
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            this.logger.log('📨 Received test message:', data);

            // Send response back to client
            client.emit('message_response', {
                success: true,
                message: 'Test message received successfully',
                receivedData: data,
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            this.logger.error(`Error handling test message from client ${client.id}:`, error);
            client.emit('connection_error', {
                success: false,
                error: { 
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                },
                timestamp: new Date().toISOString(),
            });
        }
    }

    @SubscribeMessage('pong')
    async handlePong(
        @ConnectedSocket() client: Socket,
    ): Promise<void> {
        try {
            this.webSocketService.handlePong(client.id);
            this.logger.debug(`Received pong from client ${client.id}`);
        } catch (error) {
            this.logger.error(`Error handling pong from client ${client.id}:`, error);
        }
    }

    // ===========================================
    // CONNECTION MANAGEMENT
    // ===========================================

    afterInit(server: Server) {
        try {
            this.webSocketService.setServer(server);
            this.logger.log('WebSocket Gateway initialized');
            
            // Start heartbeat interval
            this.startHeartbeat();
            
            // Start orphaned connection cleanup
            this.startOrphanedConnectionCleanup();
            
        } catch (error) {
            this.logger.error('Error initializing WebSocket Gateway:', error);
        }
    }

    async handleConnection(client: Socket) {
        try {
            this.logger.log(`Client attempting to connect: ${client.id}`);

            // Extract and validate token
            const token = this.extractTokenFromHandshake(client);

            if (!token) {
                this.logger.warn(`Client ${client.id} attempted to connect without token`);
                client.emit('auth_error', {
                    success: false,
                    error: { 
                        message: 'Authentication token required',
                        code: 'AUTH_TOKEN_MISSING'
                    },
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Validate JWT token and get user
            const user = await this.validateToken(token);

            if (!user) {
                this.logger.warn(`Client ${client.id} provided invalid token`);
                client.emit('auth_error', {
                    success: false,
                    error: { 
                        message: 'Invalid authentication token',
                        code: 'INVALID_TOKEN'
                    },
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Store user in client data for later access
            client.data.user = user;

            // Handle reconnection if user already has a connection
            await this.handleReconnection(client, user);

            // Add connection to service
            const connection = this.webSocketService.addConnection(client, user);

            // Notify client of successful connection
            client.emit('user_connected', {
                success: true,
                data: {
                    socketId: client.id,
                    user: connection.user,
                    connectedAt: connection.connectedAt,
                },
                timestamp: new Date().toISOString(),
            });

            // Broadcast to other clients that a user connected (optional)
            client.broadcast.emit('user_connected', {
                success: true,
                data: { user: connection.user },
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Client connected successfully: ${client.id} (User: ${user.email})`);

        } catch (error) {
            this.logger.error(`Connection error for client ${client.id}:`, error.message);
            client.emit('connection_error', {
                success: false,
                error: { 
                    message: 'Connection failed',
                    code: 'CONNECTION_FAILED'
                },
                timestamp: new Date().toISOString(),
            });
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        try {
            const connection = this.webSocketService.getConnection(client.id);

            if (connection) {
                this.logger.log(`Client disconnecting: ${client.id} (User: ${connection.user.email})`);

                // Notify other clients that user disconnected
                client.broadcast.emit('user_disconnected', {
                    success: true,
                    data: { userId: connection.userId },
                    timestamp: new Date().toISOString(),
                });
            } else {
                this.logger.log(`Client disconnecting: ${client.id} (Unknown user)`);
            }

            this.webSocketService.removeConnection(client.id);
            
            // Clean up rate limiting data
            this.rateLimitMap.delete(client.id);
            
        } catch (error) {
            this.logger.error(`Error handling disconnect for client ${client.id}:`, error);
        }
    }

    // ===========================================
    // RATE LIMITING
    // ===========================================

    private checkRateLimit(clientId: string): boolean {
        const now = Date.now();
        const clientRateLimit = this.rateLimitMap.get(clientId);

        if (!clientRateLimit || now > clientRateLimit.resetTime) {
            // Reset or create new rate limit info
            this.rateLimitMap.set(clientId, {
                requests: 1,
                resetTime: now + this.rateLimitConfig.windowMs,
            });
            return true;
        }

        if (clientRateLimit.requests >= this.rateLimitConfig.maxRequests) {
            return false;
        }

        clientRateLimit.requests++;
        return true;
    }

    // ===========================================
    // VALIDATION METHODS
    // ===========================================

    private validateTestMessageData(data: any): boolean {
        // Basic validation - can be extended based on requirements
        return data !== null && data !== undefined;
    }

    // ===========================================
    // HEARTBEAT AND CLEANUP
    // ===========================================

    private startHeartbeat(): void {
        setInterval(() => {
            try {
                const connections = this.webSocketService.getAllConnections();
                this.logger.debug(`Sending heartbeat to ${connections.length} connections`);
                
                connections.forEach(connection => {
                    this.webSocketService.ping(connection.id);
                });
            } catch (error) {
                this.logger.error('Error during heartbeat:', error);
            }
        }, 30000); // Every 30 seconds
    }

    private startOrphanedConnectionCleanup(): void {
        setInterval(() => {
            try {
                this.webSocketService.cleanupOrphanedConnections();
            } catch (error) {
                this.logger.error('Error during orphaned connection cleanup:', error);
            }
        }, 60000); // Every minute
    }

    // ===========================================
    // PRIVATE HELPER METHODS
    // ===========================================

    private extractTokenFromHandshake(client: Socket): string | null {
        try {
            // Try different token locations
            if (client.handshake.auth?.token) {
                return client.handshake.auth.token;
            }

            if (client.handshake.headers?.authorization) {
                const authHeader = client.handshake.headers.authorization;
                const match = authHeader.match(/^Bearer\s+(.*)$/);
                return match ? match[1] : null;
            }

            if (client.handshake.query?.token) {
                return Array.isArray(client.handshake.query.token)
                    ? client.handshake.query.token[0]
                    : client.handshake.query.token;
            }

            return null;
        } catch (error) {
            this.logger.error('Error extracting token from handshake:', error);
            return null;
        }
    }

    private async validateToken(token: string): Promise<WebSocketUser | null> {
        try {
            this.logger.log(`Attempting to validate token: ${token.substring(0, 20)}...`);

            // Verify JWT token
            const payload = this.jwtService.verify(token);

            if (!payload.sub) {
                throw new Error('Invalid token payload');
            }

            // Fetch user from database to ensure they still exist and are active
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                },
            });

            if (!user) {
                this.logger.warn(`User not found for token: ${payload.sub}`);
                return null;
            }

            this.logger.log(`Token validated successfully for user: ${user.email}`);
            return user;

        } catch (error) {
            this.logger.error('Token validation error:', error.message);
            return null;
        }
    }

    private async handleReconnection(client: Socket, user: WebSocketUser) {
        try {
            const existingConnection = this.webSocketService.getConnectionByUserId(user.id);

            if (existingConnection) {
                this.logger.log(`User ${user.email} reconnecting. Removing old connection: ${existingConnection.id}`);
                
                // Remove old connection
                this.webSocketService.removeConnection(existingConnection.id);
                
                // Rejoin all voting rooms for the user
                const userVotingRooms = this.webSocketService.getUserVotingRooms(user.id);
                for (const votingId of userVotingRooms) {
                    this.webSocketService.joinVotingRoom(client.id, votingId);
                }
                
                this.logger.log(`User ${user.email} reconnected and rejoined ${userVotingRooms.length} voting rooms`);
            }
        } catch (error) {
            this.logger.error(`Error handling reconnection for user ${user.email}:`, error);
        }
    }
}
