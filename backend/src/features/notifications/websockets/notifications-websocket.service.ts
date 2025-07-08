import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { 
  NotificationWebSocketData, 
  VotingNotificationData, 
  BroadcastNotificationPayload, 
  NotificationSocketClient 
} from '../../../shared/types/notification-websocket.types';

@Injectable()
export class NotificationsWebSocketService {
  private readonly logger = new Logger(NotificationsWebSocketService.name);
  private server: Server;
  private connectedClients = new Map<string, NotificationSocketClient>();

  setServer(server: Server) {
    this.server = server;
  }

  handleUserConnect(socket: Socket, userId: string) {
    const client: NotificationSocketClient = {
      userId,
      socketId: socket.id,
      connectedAt: new Date(),
    };

    this.connectedClients.set(socket.id, client);
    
    // Join user to their personal notification room
    const userRoom = this.getUserRoom(userId);
    socket.join(userRoom);

    this.logger.log(`User ${userId} connected to notifications (socket: ${socket.id})`);
    this.logger.debug(`User joined room: ${userRoom}`);
  }

  handleUserDisconnect(socketId: string) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      this.connectedClients.delete(socketId);
      this.logger.log(`User ${client.userId} disconnected from notifications (socket: ${socketId})`);
    }
  }

  /**
   * Send a real-time notification to a specific user
   */
  async sendRealTimeNotification(userId: string, notification: NotificationWebSocketData) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    const userRoom = this.getUserRoom(userId);
    
    this.logger.debug(`Sending real-time notification to user ${userId} in room ${userRoom}`);
    
    this.server.to(userRoom).emit('notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date(),
    });

    this.logger.log(`Real-time notification sent to user ${userId}: ${notification.title}`);
  }

  /**
   * Send a voting-related notification to a user
   */
  async sendVotingNotification(userId: string, notification: VotingNotificationData) {
    await this.sendRealTimeNotification(userId, notification);
  }

  /**
   * Broadcast notification to multiple users or all connected users
   */
  async broadcastNotification(payload: BroadcastNotificationPayload) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    const { targetUserIds, excludeUserIds, notification } = payload;
    
    if (targetUserIds && targetUserIds.length > 0) {
      // Send to specific users
      for (const userId of targetUserIds) {
        if (!excludeUserIds || !excludeUserIds.includes(userId)) {
          await this.sendRealTimeNotification(userId, notification);
        }
      }
      this.logger.log(`Broadcast notification sent to ${targetUserIds.length} specific users`);
    } else {
      // Send to all connected users (except excluded ones)
      const connectedUserIds = this.getConnectedUserIds();
      const filteredUserIds = excludeUserIds 
        ? connectedUserIds.filter(id => !excludeUserIds.includes(id))
        : connectedUserIds;

      this.server.emit('broadcast_notification', {
        type: 'broadcast_notification',
        data: notification,
        timestamp: new Date(),
      });

      this.logger.log(`Broadcast notification sent to all users (${filteredUserIds.length} connected)`);
    }
  }

  /**
   * Send notification when a new voting is created
   */
  async notifyNewVoting(userIds: string[], votingData: VotingNotificationData) {
    const notification: VotingNotificationData = {
      ...votingData,
      type: 'info',
      priority: 'high',
      title: 'Nueva Votación Disponible',
      message: `Se ha creado una nueva votación: ${votingData.votingTitle}`,
    };

    await this.broadcastNotification({
      targetUserIds: userIds,
      notification,
    });

    this.logger.log(`New voting notification sent to ${userIds.length} users`);
  }

  /**
   * Send notification when voting is about to close
   */
  async notifyVotingDeadlineSoon(userIds: string[], votingData: VotingNotificationData) {
    const notification: VotingNotificationData = {
      ...votingData,
      type: 'warning',
      priority: 'high',
      title: 'Votación Próxima a Cerrar',
      message: `La votación "${votingData.votingTitle}" cerrará pronto`,
    };

    await this.broadcastNotification({
      targetUserIds: userIds,
      notification,
    });

    this.logger.log(`Voting deadline notification sent to ${userIds.length} users`);
  }

  /**
   * Send notification when quorum is reached
   */
  async notifyQuorumReached(userIds: string[], votingData: VotingNotificationData) {
    const notification: VotingNotificationData = {
      ...votingData,
      type: 'success',
      priority: 'high',
      title: 'Quórum Alcanzado',
      message: `Se ha alcanzado el quórum para la votación "${votingData.votingTitle}"`,
    };

    await this.broadcastNotification({
      targetUserIds: userIds,
      notification,
    });

    this.logger.log(`Quorum reached notification sent to ${userIds.length} users`);
  }

  /**
   * Send notification when voting results are available
   */
  async notifyVotingResults(userIds: string[], votingData: VotingNotificationData) {
    const notification: VotingNotificationData = {
      ...votingData,
      type: 'info',
      priority: 'medium',
      title: 'Resultados de Votación Disponibles',
      message: `Los resultados de la votación "${votingData.votingTitle}" ya están disponibles`,
    };

    await this.broadcastNotification({
      targetUserIds: userIds,
      notification,
    });

    this.logger.log(`Voting results notification sent to ${userIds.length} users`);
  }

  /**
   * Send critical system notification
   */
  async sendCriticalNotification(userIds: string[], notification: NotificationWebSocketData) {
    const criticalNotification: NotificationWebSocketData = {
      ...notification,
      priority: 'critical',
    };

    await this.broadcastNotification({
      targetUserIds: userIds,
      notification: criticalNotification,
    });

    this.logger.warn(`Critical notification sent to ${userIds.length} users: ${notification.title}`);
  }

  /**
   * Get the room ID for a specific user
   */
  private getUserRoom(userId: string): string {
    return `user_${userId}`;
  }

  /**
   * Get all connected user IDs
   */
  private getConnectedUserIds(): string[] {
    const userIds = new Set<string>();
    for (const client of this.connectedClients.values()) {
      userIds.add(client.userId);
    }
    return Array.from(userIds);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connected users count (unique users)
   */
  getConnectedUsersCount(): number {
    return this.getConnectedUserIds().length;
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.getConnectedUserIds().includes(userId);
  }
}
