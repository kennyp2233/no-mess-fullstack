import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { VotingRoom, VotingParticipant } from './voting-websocket.types';

@Injectable()
export class VotingWebSocketService {
  private readonly logger = new Logger(VotingWebSocketService.name);
  private server: Server;
  private votingRooms = new Map<string, VotingRoom>(); // votingId -> VotingRoom
  private userRooms = new Map<string, Set<string>>(); // userId -> Set<votingId>
  private socketToUser = new Map<string, string>(); // socketId -> userId

  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Join a voting room
   */
  joinVotingRoom(socketId: string, userId: string, votingId: string): boolean {
    try {
      // Get or create room
      if (!this.votingRooms.has(votingId)) {
        this.votingRooms.set(votingId, {
          votingId,
          participants: new Set(),
          participantsCount: 0,
          createdAt: new Date(),
          lastActivity: new Date(),
        });
      }

      const room = this.votingRooms.get(votingId)!;
      
      // Add participant to room
      room.participants.add(socketId);
      room.participantsCount = room.participants.size;
      room.lastActivity = new Date();

      // Track user's rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(votingId);

      // Map socket to user
      this.socketToUser.set(socketId, userId);

      // Join Socket.IO room
      if (this.server) {
        // In a namespace, we need to find the socket differently
        // Since we can't directly access the socket by ID in namespace,
        // we'll let the gateway handle the Socket.IO room joining
        // The important part is that we track the room membership here
      } else {
        this.logger.warn(`Server not initialized in VotingWebSocketService`);
      }

      this.logger.log(`Socket ${socketId} (User ${userId}) joined voting room ${votingId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error joining voting room: ${error.message}`);
      return false;
    }
  }

  /**
   * Leave a voting room
   */
  leaveVotingRoom(socketId: string, votingId: string): boolean {
    try {
      const userId = this.socketToUser.get(socketId);
      
      if (!userId) {
        this.logger.warn(`Socket ${socketId} not mapped to any user`);
        return false;
      }

      const room = this.votingRooms.get(votingId);
      if (!room) {
        this.logger.warn(`Voting room ${votingId} not found`);
        return false;
      }

      // Remove from room
      room.participants.delete(socketId);
      room.participantsCount = room.participants.size;
      room.lastActivity = new Date();

      // Remove from user's rooms
      const userRooms = this.userRooms.get(userId);
      if (userRooms) {
        userRooms.delete(votingId);
        if (userRooms.size === 0) {
          this.userRooms.delete(userId);
        }
      }

      // Leave Socket.IO room
      if (this.server) {
        // In a namespace, we need to handle socket leaving differently
        // The gateway will handle the actual Socket.IO room leaving
        // We just track the room membership here
      }

      // Clean up empty room
      if (room.participants.size === 0) {
        this.votingRooms.delete(votingId);
        this.logger.log(`Removed empty voting room ${votingId}`);
      }

      this.logger.log(`Socket ${socketId} (User ${userId}) left voting room ${votingId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error leaving voting room: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove user from all voting rooms (on disconnect)
   */
  removeFromAllVotingRooms(socketId: string): void {
    try {
      const userId = this.socketToUser.get(socketId);
      if (!userId) return;

      const userRooms = this.userRooms.get(userId);
      if (userRooms) {
        // Leave all rooms
        for (const votingId of userRooms) {
          this.leaveVotingRoom(socketId, votingId);
        }
      }

      // Clean up mapping
      this.socketToUser.delete(socketId);
    } catch (error) {
      this.logger.error(`Error removing socket from voting rooms: ${error.message}`);
    }
  }

  /**
   * Check if user is in a specific voting room
   */
  isUserInVotingRoom(userId: string, votingId: string): boolean {
    const userRooms = this.userRooms.get(userId);
    return userRooms ? userRooms.has(votingId) : false;
  }

  /**
   * Get voting room stats
   */
  getVotingRoomStats(votingId: string): VotingRoom | null {
    return this.votingRooms.get(votingId) || null;
  }

  /**
   * Get all voting rooms
   */
  getAllVotingRooms(): VotingRoom[] {
    return Array.from(this.votingRooms.values());
  }

  /**
   * Get user's voting rooms
   */
  getUserVotingRooms(userId: string): string[] {
    const userRooms = this.userRooms.get(userId);
    return userRooms ? Array.from(userRooms) : [];
  }

  /**
   * Broadcast message to all participants in a voting room
   */
  broadcastToVotingRoom(
    votingId: string,
    event: string,
    data: any,
    excludeSocketId?: string
  ): void {
    try {
      if (!this.server) {
        this.logger.warn('Server not set, cannot broadcast to voting room');
        return;
      }

      const roomName = `voting:${votingId}`;
      
      if (excludeSocketId) {
        this.server.to(roomName).except(excludeSocketId).emit(event, data);
      } else {
        this.server.to(roomName).emit(event, data);
      }

      this.logger.debug(`Broadcasted ${event} to voting room ${votingId}`);
    } catch (error) {
      this.logger.error(`Error broadcasting to voting room: ${error.message}`);
    }
  }

  /**
   * Get participants in a voting room
   */
  getVotingRoomParticipants(votingId: string): string[] {
    const room = this.votingRooms.get(votingId);
    return room ? Array.from(room.participants) : [];
  }

  /**
   * Get statistics for all voting rooms
   */
  getVotingStats() {
    return {
      totalRooms: this.votingRooms.size,
      totalParticipants: Array.from(this.votingRooms.values())
        .reduce((sum, room) => sum + room.participantsCount, 0),
      roomDetails: Array.from(this.votingRooms.entries()).map(([votingId, room]) => ({
        votingId,
        participantsCount: room.participantsCount,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
      })),
    };
  }
}
