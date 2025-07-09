import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
    WebSocketConnection,
    WebSocketUser,
    WebSocketResponse,
    VotingRoom,
    VotingRoomStats
} from '../types/websocket.types';

interface ConnectionHealth {
    lastPing: Date;
    lastPong: Date | null;
    missedPings: number;
    isAlive: boolean;
}

@Injectable()
export class WebSocketService {
    private readonly logger = new Logger(WebSocketService.name);
    private server: Server;
    private connections = new Map<string, WebSocketConnection>();
    private votingRooms = new Map<string, VotingRoom>(); // votingId -> VotingRoom
    private connectionHealth = new Map<string, ConnectionHealth>();

    setServer(server: Server) {
        this.server = server;
        this.logger.log('WebSocket server instance set');
    }

    addConnection(socket: Socket, user: WebSocketUser): WebSocketConnection {
        const connection: WebSocketConnection = {
            id: socket.id,
            userId: user.id,
            user,
            connectedAt: new Date(),
        };

        this.connections.set(socket.id, connection);
        
        // Initialize health tracking
        this.connectionHealth.set(socket.id, {
            lastPing: new Date(),
            lastPong: null,
            missedPings: 0,
            isAlive: true,
        });

        this.logger.log(`User ${user.email} connected with socket ${socket.id}`);
        this.logStructuredEvent('connection_added', {
            socketId: socket.id,
            userId: user.id,
            userEmail: user.email,
            timestamp: new Date().toISOString(),
        });

        return connection;
    }

    removeConnection(socketId: string): void {
        const connection = this.connections.get(socketId);
        if (connection) {
            // Leave all voting rooms before removing connection
            this.leaveAllVotingRooms(socketId);

            this.logger.log(`User ${connection.user.email} disconnected from socket ${socketId}`);
            this.connections.delete(socketId);
            this.connectionHealth.delete(socketId);
            
            this.logStructuredEvent('connection_removed', {
                socketId,
                userId: connection.userId,
                userEmail: connection.user.email,
                timestamp: new Date().toISOString(),
            });
        }
    }

    getConnection(socketId: string): WebSocketConnection | undefined {
        return this.connections.get(socketId);
    }

    getConnectionByUserId(userId: string): WebSocketConnection | undefined {
        for (const connection of this.connections.values()) {
            if (connection.userId === userId) {
                return connection;
            }
        }
        return undefined;
    }

    getAllConnections(): WebSocketConnection[] {
        return Array.from(this.connections.values());
    }

    getConnectedUserIds(): string[] {
        return Array.from(this.connections.values()).map(conn => conn.userId);
    }

    isUserConnected(userId: string): boolean {
        return this.getConnectionByUserId(userId) !== undefined;
    }

    // ===========================================
    // HEALTH MONITORING AND CLEANUP
    // ===========================================

    cleanupOrphanedConnections(): void {
        try {
            const now = new Date();
            const orphanedConnections: string[] = [];

            for (const [socketId, health] of this.connectionHealth.entries()) {
                const connection = this.connections.get(socketId);
                if (!connection) {
                    // Connection exists in health map but not in connections map
                    this.connectionHealth.delete(socketId);
                    continue;
                }

                // Check if connection is stale (no activity for 5 minutes)
                const timeSinceLastActivity = now.getTime() - health.lastPing.getTime();
                const isStale = timeSinceLastActivity > 300000; // 5 minutes

                // Check if too many pings were missed
                const isUnresponsive = health.missedPings >= 3;

                if (isStale || isUnresponsive) {
                    orphanedConnections.push(socketId);
                    this.logger.warn(`Marking connection ${socketId} as orphaned. Stale: ${isStale}, Unresponsive: ${isUnresponsive}`);
                }
            }

            // Remove orphaned connections
            orphanedConnections.forEach(socketId => {
                this.removeConnection(socketId);
                this.logger.log(`Cleaned up orphaned connection: ${socketId}`);
            });

            if (orphanedConnections.length > 0) {
                this.logStructuredEvent('orphaned_connections_cleaned', {
                    count: orphanedConnections.length,
                    socketIds: orphanedConnections,
                    timestamp: new Date().toISOString(),
                });
            }

        } catch (error) {
            this.logger.error('Error during orphaned connection cleanup:', error);
        }
    }

    // ===========================================
    // HEARTBEAT MANAGEMENT
    // ===========================================

    ping(socketId: string): void {
        try {
            const health = this.connectionHealth.get(socketId);
            if (health) {
                health.lastPing = new Date();
                health.missedPings++;
                
                // Mark as potentially dead if too many pings missed
                if (health.missedPings >= 3) {
                    health.isAlive = false;
                }
            }

            this.sendToSocket(socketId, 'ping', { timestamp: new Date().toISOString() });
        } catch (error) {
            this.logger.error(`Error sending ping to ${socketId}:`, error);
        }
    }

    handlePong(socketId: string): void {
        try {
            const health = this.connectionHealth.get(socketId);
            if (health) {
                health.lastPong = new Date();
                health.missedPings = 0;
                health.isAlive = true;
            }
        } catch (error) {
            this.logger.error(`Error handling pong from ${socketId}:`, error);
        }
    }

    // ===========================================
    // RECONNECTION SUPPORT
    // ===========================================

    async handleUserReconnection(newSocketId: string, userId: string): Promise<boolean> {
        try {
            const connection = this.getConnection(newSocketId);
            if (!connection) {
                this.logger.warn(`Cannot handle reconnection: socket ${newSocketId} not found`);
                return false;
            }

            // Get user's previous voting rooms
            const userVotingRooms = this.getUserVotingRooms(userId);
            
            // Rejoin all rooms
            for (const votingId of userVotingRooms) {
                this.joinVotingRoom(newSocketId, votingId);
            }

            this.logStructuredEvent('user_reconnected', {
                socketId: newSocketId,
                userId,
                rejoinedRooms: userVotingRooms,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`User ${connection.user.email} reconnected and rejoined ${userVotingRooms.length} voting rooms`);
            return true;

        } catch (error) {
            this.logger.error(`Error handling reconnection for user ${userId}:`, error);
            return false;
        }
    }

    // ===========================================
    // BASIC MESSAGING UTILITIES
    // ===========================================

    sendToSocket(socketId: string, event: string, data: any): void {
        try {
            if (this.server) {
                this.server.to(socketId).emit(event, this.createResponse(true, data));
            }
        } catch (error) {
            this.logger.error(`Error sending to socket ${socketId}:`, error);
        }
    }

    sendToUser(userId: string, event: string, data: any): boolean {
        try {
            const connection = this.getConnectionByUserId(userId);
            if (connection) {
                this.sendToSocket(connection.id, event, data);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error(`Error sending to user ${userId}:`, error);
            return false;
        }
    }

    broadcast(event: string, data: any, excludeSocketId?: string): void {
        try {
            if (this.server) {
                const emitter = excludeSocketId
                    ? this.server.except(excludeSocketId)
                    : this.server;

                emitter.emit(event, this.createResponse(true, data));
            }
        } catch (error) {
            this.logger.error('Error broadcasting message:', error);
        }
    }

    // ===========================================
    // ERROR HANDLING
    // ===========================================

    sendError(socketId: string, error: { message: string; code?: string }): void {
        try {
            if (this.server) {
                this.server.to(socketId).emit('error', this.createResponse(false, null, error));
            }
        } catch (error) {
            this.logger.error(`Error sending error to socket ${socketId}:`, error);
        }
    }

    // ===========================================
    // CONNECTION STATISTICS
    // ===========================================

    getConnectionStats() {
        try {
            const now = new Date();
            const connections = this.getAllConnections();
            
            return {
                totalConnections: this.connections.size,
                connectedUsers: this.getConnectedUserIds().length,
                healthyConnections: Array.from(this.connectionHealth.values()).filter(h => h.isAlive).length,
                connections: connections.map(conn => {
                    const health = this.connectionHealth.get(conn.id);
                    return {
                        socketId: conn.id,
                        userId: conn.userId,
                        userEmail: conn.user.email,
                        userName: conn.user.name,
                        connectedAt: conn.connectedAt,
                        duration: now.getTime() - conn.connectedAt.getTime(),
                        isAlive: health?.isAlive ?? false,
                        missedPings: health?.missedPings ?? 0,
                    };
                }),
            };
        } catch (error) {
            this.logger.error('Error getting connection stats:', error);
            return {
                totalConnections: 0,
                connectedUsers: 0,
                healthyConnections: 0,
                connections: [],
            };
        }
    }

    // ===========================================
    // VOTING ROOM MANAGEMENT
    // ===========================================

    joinVotingRoom(socketId: string, votingId: string): boolean {
        try {
            const connection = this.getConnection(socketId);
            if (!connection) {
                this.logger.warn(`Cannot join voting room: socket ${socketId} not found`);
                return false;
            }

            // Get or create voting room
            let room = this.votingRooms.get(votingId);
            if (!room) {
                room = {
                    votingId,
                    participants: new Set<string>(),
                    userIds: new Set<string>(),
                    createdAt: new Date(),
                    lastActivity: new Date(),
                };
                this.votingRooms.set(votingId, room);
                this.logger.log(`Created new voting room: ${votingId}`);
            }

            // Add participant to room
            room.participants.add(socketId);
            room.userIds.add(connection.userId);
            room.lastActivity = new Date();

            // Join Socket.IO room
            if (this.server) {
                const socket = this.server.sockets.sockets.get(socketId);
                if (socket) {
                    socket.join(`voting:${votingId}`);
                    this.logger.log(`User ${connection.user.email} joined voting room ${votingId}`);
                    
                    this.logStructuredEvent('voting_room_joined', {
                        socketId,
                        userId: connection.userId,
                        votingId,
                        timestamp: new Date().toISOString(),
                    });
                    
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.logger.error(`Error joining voting room ${votingId} for socket ${socketId}:`, error);
            return false;
        }
    }

    leaveVotingRoom(socketId: string, votingId: string): boolean {
        try {
            const connection = this.getConnection(socketId);
            if (!connection) {
                return false;
            }

            const room = this.votingRooms.get(votingId);
            if (!room) {
                return false;
            }

            // Remove participant from room
            room.participants.delete(socketId);
            room.userIds.delete(connection.userId);
            room.lastActivity = new Date();

            // Leave Socket.IO room
            if (this.server) {
                const socket = this.server.sockets.sockets.get(socketId);
                if (socket) {
                    socket.leave(`voting:${votingId}`);
                    this.logger.log(`User ${connection.user.email} left voting room ${votingId}`);
                    
                    this.logStructuredEvent('voting_room_left', {
                        socketId,
                        userId: connection.userId,
                        votingId,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            // Clean up empty room
            if (room.participants.size === 0) {
                this.votingRooms.delete(votingId);
                this.logger.log(`Deleted empty voting room: ${votingId}`);
            }

            return true;
        } catch (error) {
            this.logger.error(`Error leaving voting room ${votingId} for socket ${socketId}:`, error);
            return false;
        }
    }

    leaveAllVotingRooms(socketId: string): void {
        try {
            const roomsToLeave = Array.from(this.votingRooms.keys()).filter(votingId => {
                const room = this.votingRooms.get(votingId);
                return room?.participants.has(socketId) ?? false;
            });

            roomsToLeave.forEach(votingId => {
                this.leaveVotingRoom(socketId, votingId);
            });
        } catch (error) {
            this.logger.error(`Error leaving all voting rooms for socket ${socketId}:`, error);
        }
    }

    broadcastToVotingRoom(votingId: string, event: string, data: any, excludeSocketId?: string): void {
        try {
            if (this.server) {
                const roomName = `voting:${votingId}`;
                const emitter = excludeSocketId
                    ? this.server.to(roomName).except(excludeSocketId)
                    : this.server.to(roomName);

                emitter.emit(event, this.createResponse(true, data));
            }
        } catch (error) {
            this.logger.error(`Error broadcasting to voting room ${votingId}:`, error);
        }
    }

    getVotingRoom(votingId: string): VotingRoom | undefined {
        return this.votingRooms.get(votingId);
    }

    getVotingRoomStats(votingId: string): VotingRoomStats | undefined {
        try {
            const room = this.votingRooms.get(votingId);
            if (!room) return undefined;

            return {
                votingId,
                participantsCount: room.participants.size,
                activeUsers: Array.from(room.userIds),
                lastActivity: room.lastActivity,
            };
        } catch (error) {
            this.logger.error(`Error getting voting room stats for ${votingId}:`, error);
            return undefined;
        }
    }

    getAllVotingRooms(): VotingRoomStats[] {
        try {
            return Array.from(this.votingRooms.keys()).map(votingId => {
                const stats = this.getVotingRoomStats(votingId);
                return stats!;
            }).filter(Boolean);
        } catch (error) {
            this.logger.error('Error getting all voting rooms:', error);
            return [];
        }
    }

    isUserInVotingRoom(userId: string, votingId: string): boolean {
        try {
            const room = this.votingRooms.get(votingId);
            return room?.userIds.has(userId) ?? false;
        } catch (error) {
            this.logger.error(`Error checking if user ${userId} is in voting room ${votingId}:`, error);
            return false;
        }
    }

    getUserVotingRooms(userId: string): string[] {
        try {
            return Array.from(this.votingRooms.keys()).filter(votingId => {
                return this.isUserInVotingRoom(userId, votingId);
            });
        } catch (error) {
            this.logger.error(`Error getting voting rooms for user ${userId}:`, error);
            return [];
        }
    }

    // ===========================================
    // STRUCTURED LOGGING
    // ===========================================

    private logStructuredEvent(event: string, data: any): void {
        this.logger.log(JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data,
        }));
    }

    // ===========================================
    // PRIVATE HELPER METHODS
    // ===========================================

    private createResponse<T>(
        success: boolean,
        data?: T,
        error?: { message: string; code?: string }
    ): WebSocketResponse<T> {
        return {
            success,
            data,
            error,
            timestamp: new Date().toISOString(),
        };
    }
}
