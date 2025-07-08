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
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WebSocketService } from './websocket.service';
import { WsAuthGuard } from './ws-auth.guard';
import { WsCurrentUser } from './ws-current-user.decorator';
import { WebSocketUser } from '../types/websocket.types';
import { PrismaService } from '../database/prisma.service';

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

    constructor(
        private webSocketService: WebSocketService,
        private jwtService: JwtService,
        private prisma: PrismaService,
    ) { }

    // ===========================================
    // BASIC EVENTS
    // ===========================================

    @SubscribeMessage('test_message')
    handleTestMessage(
        @MessageBody() data: any,
        @ConnectedSocket() client: Socket,
    ): void {
        this.logger.log('📨 Received test message:', data);

        // Send response back to client
        client.emit('message_response', {
            success: true,
            message: 'Test message received successfully',
            receivedData: data,
            timestamp: new Date().toISOString(),
        });
    }

    afterInit(server: Server) {
        this.webSocketService.setServer(server);
        this.logger.log('WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            this.logger.log(`Client attempting to connect: ${client.id}`);

            // Extract and validate token
            const token = this.extractTokenFromHandshake(client);

            if (!token) {
                this.logger.warn(`Client ${client.id} attempted to connect without token`);
                client.emit('auth-error', {
                    success: false,
                    error: { message: 'Authentication token required' },
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Validate JWT token and get user
            const user = await this.validateToken(token);

            if (!user) {
                this.logger.warn(`Client ${client.id} provided invalid token`);
                client.emit('auth-error', {
                    success: false,
                    error: { message: 'Invalid authentication token' },
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
            client.emit('user-connected', {
                success: true,
                data: {
                    socketId: client.id,
                    user: connection.user,
                    connectedAt: connection.connectedAt,
                },
                timestamp: new Date().toISOString(),
            });

            // Broadcast to other clients that a user connected (optional)
            client.broadcast.emit('user-connected', {
                success: true,
                data: { user: connection.user },
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Client connected successfully: ${client.id} (User: ${user.email})`);

        } catch (error) {
            this.logger.error(`Connection error for client ${client.id}:`, error.message);
            client.emit('error', {
                success: false,
                error: { message: 'Connection failed' },
                timestamp: new Date().toISOString(),
            });
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const connection = this.webSocketService.getConnection(client.id);

        if (connection) {
            this.logger.log(`Client disconnecting: ${client.id} (User: ${connection.user.email})`);

            // Notify other clients that user disconnected
            client.broadcast.emit('user-disconnected', {
                success: true,
                data: { userId: connection.userId },
                timestamp: new Date().toISOString(),
            });
        } else {
            this.logger.log(`Client disconnecting: ${client.id} (Unknown user)`);
        }

        this.webSocketService.removeConnection(client.id);
    }

    // ===========================================
    // PRIVATE HELPER METHODS
    // ===========================================

    private extractTokenFromHandshake(client: Socket): string | null {
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
                throw new Error('User not found');
            }

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.toString(),
            };
        } catch (error) {
            this.logger.warn(`Token validation failed: ${error.message}`);
            this.logger.warn(`Error details:`);
            this.logger.warn(error);
            return null;
        }
    }

    // Enhanced connection handling with reconnection support
    private async handleReconnection(client: Socket, user: WebSocketUser) {
        // Check if user has an existing connection
        const existingConnection = this.webSocketService.getConnectionByUserId(user.id);

        if (existingConnection) {
            this.logger.log(`User ${user.email} reconnecting, removing old connection ${existingConnection.id}`);

            // Remove old connection
            this.webSocketService.removeConnection(existingConnection.id);

            // Notify about reconnection
            client.emit('reconnected', {
                success: true,
                data: {
                    message: 'Successfully reconnected',
                    previousSocketId: existingConnection.id,
                    newSocketId: client.id,
                },
                timestamp: new Date().toISOString(),
            });
        }
    }
}
