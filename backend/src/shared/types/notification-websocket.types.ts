export interface NotificationWebSocketData {
  notificationId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface VotingNotificationData extends NotificationWebSocketData {
  votingId: string;
  assemblyId: string;
  assemblyTitle: string;
  votingTitle: string;
  relatedData?: {
    deadline?: Date;
    currentVotes?: number;
    requiredVotes?: number;
    results?: any;
  };
}

export interface NotificationRoom {
  userId: string;
  roomId: string;
}

export interface BroadcastNotificationPayload {
  targetUserIds?: string[];
  excludeUserIds?: string[];
  notification: NotificationWebSocketData;
}

export type NotificationWebSocketEvents = 
  | 'notification'
  | 'broadcast_notification'
  | 'notification_read'
  | 'notification_dismissed';

export interface NotificationSocketClient {
  userId: string;
  socketId: string;
  connectedAt: Date;
}
