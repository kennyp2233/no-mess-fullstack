import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../../../shared/websockets/ws-auth.guard';
import { WsCurrentUser } from '../../../shared/websockets/ws-current-user.decorator';
import { NotificationsWebSocketService } from './notifications-websocket.service';
import { WebSocketUser } from '../../../shared/types/websocket.types';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationsWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsWebSocketGateway.name);

  constructor(
    private readonly notificationsWsService: NotificationsWebSocketService,
  ) {}

  afterInit(server: Server) {
    this.notificationsWsService.setServer(server);
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  @UseGuards(WsAuthGuard)
  async handleConnection(socket: Socket) {
    try {
      // WsAuthGuard ensures user is authenticated
      const user = socket.data.user as WebSocketUser;
      
      this.notificationsWsService.handleUserConnect(socket, user.id);
      
      this.logger.log(`User ${user.id} connected to notifications namespace`);
    } catch (error) {
      this.logger.error('Error handling connection:', error);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.notificationsWsService.handleUserDisconnect(socket.id);
    this.logger.log(`Socket ${socket.id} disconnected from notifications`);
  }

  /**
   * Handle notification read confirmation
   */
  @SubscribeMessage('notification_read')
  @UseGuards(WsAuthGuard)
  async handleNotificationRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: Socket,
    @WsCurrentUser() user: WebSocketUser,
  ) {
    this.logger.debug(`User ${user.id} marked notification ${data.notificationId} as read`);
    
    // Acknowledge the read status
    socket.emit('notification_read_confirmed', {
      notificationId: data.notificationId,
      timestamp: new Date(),
    });
  }

  /**
   * Handle notification dismissal
   */
  @SubscribeMessage('notification_dismissed')
  @UseGuards(WsAuthGuard)
  async handleNotificationDismissed(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: Socket,
    @WsCurrentUser() user: WebSocketUser,
  ) {
    this.logger.debug(`User ${user.id} dismissed notification ${data.notificationId}`);
    
    // Acknowledge the dismissal
    socket.emit('notification_dismissed_confirmed', {
      notificationId: data.notificationId,
      timestamp: new Date(),
    });
  }

  /**
   * Handle ping from client (keep-alive)
   */
  @SubscribeMessage('ping')
  @UseGuards(WsAuthGuard)
  async handlePing(
    @ConnectedSocket() socket: Socket,
    @WsCurrentUser() user: WebSocketUser,
  ) {
    socket.emit('pong', {
      userId: user.id,
      timestamp: new Date(),
    });
  }

  /**
   * Get connection status for debugging
   */
  @SubscribeMessage('get_connection_status')
  @UseGuards(WsAuthGuard)
  async handleGetConnectionStatus(
    @ConnectedSocket() socket: Socket,
    @WsCurrentUser() user: WebSocketUser,
  ) {
    const status = {
      userId: user.id,
      socketId: socket.id,
      connectedClients: this.notificationsWsService.getConnectedClientsCount(),
      connectedUsers: this.notificationsWsService.getConnectedUsersCount(),
      isUserConnected: this.notificationsWsService.isUserConnected(user.id),
      timestamp: new Date(),
    };

    socket.emit('connection_status', status);
    this.logger.debug(`Connection status sent to user ${user.id}:`, status);
  }
}
