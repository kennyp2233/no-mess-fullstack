import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
    WebSocketConnection,
    WebSocketUser,
    WebSocketResponse,
    VotingRoom,
    VotingRoomStats
} from '../types/websocket.types';

@Injectable()
export class WebSocketService {
    private readonly logger = new Logger(WebSocketService.name);
    private server: Server;
    private connections = new Map<string, WebSocketConnection>();
    private votingRooms = new Map<string, VotingRoom>(); // votingId -> VotingRoom

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
        this.logger.log(`User ${user.email} connected with socket ${socket.id}`);

        return connection;
    }

    removeConnection(socketId: string): void {
        const connection = this.connections.get(socketId);
        if (connection) {
            // Leave all voting rooms before removing connection
            this.leaveAllVotingRooms(socketId);

            this.logger.log(`User ${connection.user.email} disconnected from socket ${socketId}`);
            this.connections.delete(socketId);
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

    // Basic messaging utilities
    sendToSocket(socketId: string, event: string, data: any): void {
        if (this.server) {
            this.server.to(socketId).emit(event, this.createResponse(true, data));
        }
    }

    sendToUser(userId: string, event: string, data: any): boolean {
        const connection = this.getConnectionByUserId(userId);
        if (connection) {
            this.sendToSocket(connection.id, event, data);
            return true;
        }
        return false;
    }

    broadcast(event: string, data: any, excludeSocketId?: string): void {
        if (this.server) {
            const emitter = excludeSocketId
                ? this.server.except(excludeSocketId)
                : this.server;

            emitter.emit(event, this.createResponse(true, data));
        }
    }

    // Error handling
    sendError(socketId: string, error: { message: string; code?: string }): void {
        this.sendToSocket(socketId, 'error', null);
        if (this.server) {
            this.server.to(socketId).emit('error', this.createResponse(false, null, error));
        }
    }

    // Health check
    ping(socketId: string): void {
        this.sendToSocket(socketId, 'ping', { timestamp: new Date().toISOString() });
    }

    // Connection statistics
    getConnectionStats() {
        return {
            totalConnections: this.connections.size,
            connectedUsers: this.getConnectedUserIds().length,
            connections: this.getAllConnections().map(conn => ({
                socketId: conn.id,
                userId: conn.userId,
                userEmail: conn.user.email,
                userName: conn.user.name,
                connectedAt: conn.connectedAt,
                duration: Date.now() - conn.connectedAt.getTime(),
            })),
        };
    }

    // Voting Room Management
    joinVotingRoom(socketId: string, votingId: string): boolean {
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
                return true;
            }
        }

        return false;
    }

    leaveVotingRoom(socketId: string, votingId: string): boolean {
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
            }
        }

        // Clean up empty room
        if (room.participants.size === 0) {
            this.votingRooms.delete(votingId);
            this.logger.log(`Deleted empty voting room: ${votingId}`);
        }

        return true;
    }

    leaveAllVotingRooms(socketId: string): void {
        const connection = this.getConnection(socketId);
        if (!connection) {
            return;
        }

        // Find all rooms this socket is in and leave them
        for (const [votingId, room] of this.votingRooms.entries()) {
            if (room.participants.has(socketId)) {
                this.leaveVotingRoom(socketId, votingId);
            }
        }
    }

    broadcastToVotingRoom(votingId: string, event: string, data: any, excludeSocketId?: string): void {
        if (!this.server) {
            return;
        }

        const roomName = `voting:${votingId}`;
        const emitter = excludeSocketId
            ? this.server.to(roomName).except(excludeSocketId)
            : this.server.to(roomName);

        emitter.emit(event, this.createResponse(true, data));

        const room = this.votingRooms.get(votingId);
        if (room) {
            room.lastActivity = new Date();
        }

        this.logger.log(`Broadcasted ${event} to voting room ${votingId}`);
    }

    getVotingRoom(votingId: string): VotingRoom | undefined {
        return this.votingRooms.get(votingId);
    }

    getVotingRoomStats(votingId: string): VotingRoomStats | undefined {
        const room = this.votingRooms.get(votingId);
        if (!room) {
            return undefined;
        }

        return {
            votingId,
            participantsCount: room.participants.size,
            activeUsers: Array.from(room.userIds),
            lastActivity: room.lastActivity,
        };
    }

    getAllVotingRooms(): VotingRoomStats[] {
        return Array.from(this.votingRooms.values()).map(room => ({
            votingId: room.votingId,
            participantsCount: room.participants.size,
            activeUsers: Array.from(room.userIds),
            lastActivity: room.lastActivity,
        }));
    }

    isUserInVotingRoom(userId: string, votingId: string): boolean {
        const room = this.votingRooms.get(votingId);
        return room ? room.userIds.has(userId) : false;
    }

    getUserVotingRooms(userId: string): string[] {
        const votingIds: string[] = [];
        for (const [votingId, room] of this.votingRooms.entries()) {
            if (room.userIds.has(userId)) {
                votingIds.push(votingId);
            }
        }
        return votingIds;
    }

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
