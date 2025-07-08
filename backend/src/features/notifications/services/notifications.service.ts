import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { 
  CreateNotificationDto, 
  BulkNotificationDto,
  UpdateNotificationDto,
  QueryNotificationsDto,
  NotificationType,
  NotificationPriority 
} from '../dto';
import { EmailService } from './email.service';
import { NotificationsWebSocketService } from '../websockets/notifications-websocket.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @Inject(forwardRef(() => NotificationsWebSocketService))
    private notificationsWebSocketService: NotificationsWebSocketService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createNotificationDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        priority: createNotificationDto.priority || 'MEDIUM',
        userId: createNotificationDto.userId,
        entityType: createNotificationDto.entityType,
        entityId: createNotificationDto.entityId,
        metadata: createNotificationDto.metadata,
        isRead: false,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Send email if requested
    if (createNotificationDto.sendEmail) {
      await this.sendEmailNotification(
        user,
        createNotificationDto.type,
        {
          title: createNotificationDto.title,
          message: createNotificationDto.message,
          userName: user.name,
          ...createNotificationDto.metadata,
        }
      );
    }

    return notification;
  }

  async createBulk(bulkNotificationDto: BulkNotificationDto) {
    const notifications = [];
    
    for (const userId of bulkNotificationDto.userIds) {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.warn(`User ${userId} not found, skipping notification`);
        continue;
      }

      // Create notification
      const notification = await this.prisma.notification.create({
        data: {
          title: bulkNotificationDto.title,
          message: bulkNotificationDto.message,
          type: bulkNotificationDto.type,
          priority: bulkNotificationDto.priority || 'MEDIUM',
          userId,
          entityType: bulkNotificationDto.entityType,
          entityId: bulkNotificationDto.entityId,
          metadata: bulkNotificationDto.metadata,
          isRead: false,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      notifications.push(notification);

      // Send email if requested
      if (bulkNotificationDto.sendEmail) {
        await this.sendEmailNotification(
          user,
          bulkNotificationDto.type,
          {
            title: bulkNotificationDto.title,
            message: bulkNotificationDto.message,
            userName: user.name,
            ...bulkNotificationDto.metadata,
          }
        );
      }
    }

    return notifications;
  }

  async findAll(query: QueryNotificationsDto = {}) {
    const {
      page = 1,
      limit = 20,
      userId,
      read,
      type,
      entityType,
      entityId,
      createdAfter,
      createdBefore,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (read !== undefined) where.isRead = read;
    if (type) where.type = type;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    
    if (createdAfter || createdBefore) {
      where.createdAt = {};
      if (createdAfter) where.createdAt.gte = new Date(createdAfter);
      if (createdBefore) where.createdAt.lte = new Date(createdBefore);
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updatedNotification;
  }

  async markAsUnread(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: { isRead: false },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updatedNotification;
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { 
        userId,
        isRead: false 
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { 
        userId,
        isRead: false 
      },
    });
  }

  async remove(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { message: 'Notification deleted successfully' };
  }

  async update(id: string, updateData: UpdateNotificationDto) {
    // First check if notification exists
    const existingNotification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async clearAllForUser(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });

    return { message: 'All notifications cleared successfully' };
  }

  // Integration methods for automatic notifications
  async notifyAssemblyCreated(assemblyId: string, houseId: string) {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: assemblyId },
      include: { house: true },
    });

    if (!assembly) return;

    const houseUsers = await this.prisma.houseUser.findMany({
      where: { houseId },
      include: { user: true },
    });

    const userIds = houseUsers.map(hu => hu.userId);

    await this.createBulk({
      title: `Nueva Asamblea: ${assembly.title}`,
      message: `Se ha programado una nueva asamblea para el ${new Date(assembly.date).toLocaleDateString()}`,
      type: NotificationType.ASSEMBLY_CREATED,
      userIds,
      entityId: assemblyId,
      entityType: 'assembly',
      sendEmail: true,
      metadata: {
        title: assembly.title,
        date: new Date(assembly.date).toLocaleDateString(),
        location: assembly.location || 'Por confirmar',
        description: assembly.description || '',
      },
    });
  }

  async notifyVotingStarted(votingId: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: { 
        assembly: { 
          include: { house: true } 
        } 
      },
    });

    if (!voting) return;

    const houseUsers = await this.prisma.houseUser.findMany({
      where: { houseId: voting.assembly.houseId },
      include: { user: true },
    });

    const userIds = houseUsers.map(hu => hu.userId);

    await this.createBulk({
      title: `Nueva Votación: ${voting.title}`,
      message: `Se ha iniciado una nueva votación. Su participación es importante.`,
      type: NotificationType.VOTING_STARTED,
      userIds,
      entityId: votingId,
      entityType: 'voting',
      sendEmail: true,
      metadata: {
        title: voting.title,
        description: voting.description || '',
        endDate: new Date(voting.endDate).toLocaleDateString(),
      },
    });
  }

  async notifyProposalStatusChange(proposalId: string, newStatus: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: true },
    });

    if (!proposal) return;

    const isApproved = newStatus === 'APPROVED';
    const type = isApproved ? NotificationType.PROPOSAL_APPROVED : NotificationType.PROPOSAL_REJECTED;
    
    await this.create({
      title: `Propuesta ${isApproved ? 'Aprobada' : 'Rechazada'}`,
      message: `Su propuesta "${proposal.title}" ha sido ${isApproved ? 'aprobada' : 'rechazada'}.`,
      type,
      userId: proposal.userId,
      entityId: proposalId,
      entityType: 'proposal',
      sendEmail: true,
      metadata: {
        title: proposal.title,
        reason: isApproved ? '' : 'Ver detalles en el sistema',
      },
    });
  }

  async notifyProjectCompleted(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { house: true },
    });

    if (!project) return;

    const houseUsers = await this.prisma.houseUser.findMany({
      where: { houseId: project.houseId },
      include: { user: true },
    });

    const userIds = houseUsers.map(hu => hu.userId);

    await this.createBulk({
      title: `Proyecto Completado: ${project.title}`,
      message: `El proyecto "${project.title}" ha sido completado exitosamente.`,
      type: NotificationType.PROJECT_COMPLETED,
      userIds,
      entityId: projectId,
      entityType: 'project',
      sendEmail: true,
      metadata: {
        title: project.title,
        budget: project.budget.toLocaleString(),
        completedDate: new Date().toLocaleDateString(),
      },
    });
  }

  async notifyBudgetAlert(houseId: string, alertType: string, alertData: any) {
    const houseUsers = await this.prisma.houseUser.findMany({
      where: { 
        houseId,
        user: {
          role: { in: ['ADMIN', 'TREASURER', 'PRESIDENT'] }
        }
      },
      include: { user: true },
    });

    const userIds = houseUsers.map(hu => hu.userId);

    const type = alertType === 'EXCEEDED' ? NotificationType.BUDGET_EXCEEDED : NotificationType.BUDGET_ALERT;
    
    await this.createBulk({
      title: `Alerta de Presupuesto - ${alertData.year}`,
      message: `Se ha detectado una alerta en el presupuesto del año ${alertData.year}.`,
      type,
      userIds,
      entityId: houseId,
      entityType: 'budget',
      sendEmail: true,
      metadata: alertData,
    });
  }

  async notifyMinutesPublished(minutesId: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id: minutesId },
      include: { 
        assembly: { 
          include: { house: true } 
        } 
      },
    });

    if (!minutes) return;

    const houseUsers = await this.prisma.houseUser.findMany({
      where: { houseId: minutes.assembly.houseId },
      include: { user: true },
    });

    const userIds = houseUsers.map(hu => hu.userId);

    await this.createBulk({
      title: `Acta Publicada: ${minutes.title}`,
      message: `Se ha publicado el acta de la asamblea "${minutes.assembly.title}".`,
      type: NotificationType.MINUTES_PUBLISHED,
      userIds,
      entityId: minutesId,
      entityType: 'minutes',
      sendEmail: false, // Only in-app notification for minutes
      metadata: {
        title: minutes.title,
        assemblyDate: new Date(minutes.assembly.date).toLocaleDateString(),
      },
    });
  }

  private async sendEmailNotification(user: any, type: NotificationType, data: any) {
    try {
      const { subject, content } = this.emailService.generateEmailContent(type, data, user.email);
      await this.emailService.sendEmail(user.email, subject, content);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Don't throw error - notification should still be created even if email fails
    }
  }

  // ========================================
  // REAL-TIME WEBSOCKET NOTIFICATIONS
  // ========================================

  /**
   * Send real-time notification to specific user
   */
  async sendRealTimeNotification(userId: string, notification: any, isUrgent: boolean = false) {
    try {
      // Convert notification to the format expected by NotificationsWebSocketService
      const notificationData = {
        notificationId: notification.id || `notification_${Date.now()}`,
        title: notification.title,
        message: notification.message,
        type: isUrgent ? 'warning' as const : 'info' as const,
        priority: isUrgent ? 'critical' as const : 'medium' as const,
        metadata: notification.metadata || notification.data || {},
        createdAt: new Date(),
      };

      // Send via dedicated notifications WebSocket service
      await this.notificationsWebSocketService.sendRealTimeNotification(userId, notificationData);

      console.log(`✅ Real-time notification sent to user ${userId}${isUrgent ? ' (URGENT)' : ''}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending real-time notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast notification to multiple users
   */
  async broadcastNotification(userIds: string[], notification: any, isUrgent: boolean = false) {
    try {
      // Convert notification to the format expected by NotificationsWebSocketService
      const notificationData = {
        notificationId: notification.id || `broadcast_${Date.now()}`,
        title: notification.title,
        message: notification.message,
        type: isUrgent ? 'warning' as const : 'info' as const,
        priority: isUrgent ? 'critical' as const : 'medium' as const,
        metadata: notification.metadata || notification.data || {},
        createdAt: new Date(),
      };

      // Send to all specified users via dedicated notifications WebSocket service
      await this.notificationsWebSocketService.broadcastNotification({
        targetUserIds: userIds,
        notification: notificationData,
      });

      console.log(`✅ Broadcast notification sent to ${userIds.length} users${isUrgent ? ' (URGENT)' : ''}`);
      
      return { success: userIds.length, total: userIds.length };
    } catch (error) {
      console.error(`❌ Error broadcasting notification:`, error);
      return { success: 0, total: userIds.length };
    }
  }

  /**
   * Send critical voting notification
   */
  async sendCriticalVotingNotification(userId: string, eventType: string, votingData: any) {
    try {
      const notification = {
        id: `voting_${eventType}_${Date.now()}`,
        type: 'VOTING_CRITICAL',
        title: this.getVotingNotificationTitle(eventType),
        message: this.getVotingNotificationMessage(eventType, votingData),
        data: votingData,
        eventType,
        urgent: this.isVotingEventUrgent(eventType),
        category: 'voting'
      };

      // Save to database
      await this.create({
        userId,
        title: notification.title,
        message: notification.message,
        type: 'VOTING_CRITICAL' as NotificationType,
        priority: notification.urgent ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
        entityType: 'voting',
        entityId: votingData.votingId,
        metadata: { eventType, ...votingData }
      });

      // Send real-time notification
      await this.sendRealTimeNotification(userId, notification, notification.urgent);

      return notification;
    } catch (error) {
      console.error(`❌ Error sending critical voting notification:`, error);
      throw error;
    }
  }

  /**
   * Broadcast critical voting event to all eligible users
   */
  async broadcastCriticalVotingEvent(eligibleUserIds: string[], eventType: string, votingData: any) {
    try {
      const notification = {
        id: `voting_broadcast_${eventType}_${Date.now()}`,
        type: 'VOTING_BROADCAST',
        title: this.getVotingNotificationTitle(eventType),
        message: this.getVotingNotificationMessage(eventType, votingData),
        data: votingData,
        eventType,
        urgent: this.isVotingEventUrgent(eventType),
        category: 'voting_broadcast'
      };

      // Save notifications to database for all users
      const createPromises = eligibleUserIds.map(userId =>
        this.create({
          userId,
          title: notification.title,
          message: notification.message,
          type: 'VOTING_BROADCAST' as NotificationType,
          priority: notification.urgent ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          entityType: 'voting',
          entityId: votingData.votingId,
          metadata: { eventType, ...votingData }
        }).catch(error => {
          console.error(`Failed to create notification for user ${userId}:`, error);
          return null;
        })
      );

      await Promise.all(createPromises);

      // Broadcast real-time notification
      await this.broadcastNotification(eligibleUserIds, notification, notification.urgent);

      console.log(`✅ Critical voting event '${eventType}' broadcasted to ${eligibleUserIds.length} users`);
      return notification;
    } catch (error) {
      console.error(`❌ Error broadcasting critical voting event:`, error);
      throw error;
    }
  }

  /**
   * Send voting reminder notification
   */
  async sendVotingReminder(userId: string, votingData: any, timeRemaining: string) {
    const notification = {
      id: `voting_reminder_${Date.now()}`,
      type: 'VOTING_REMINDER',
      title: '⏰ Voting Reminder',
      message: `Reminder: Please cast your vote for "${votingData.title}". ${timeRemaining} remaining.`,
      data: { ...votingData, timeRemaining },
      eventType: 'voting_reminder',
      urgent: timeRemaining.includes('minute'), // Urgent if less than 1 hour
      category: 'voting_reminder'
    };

    return await this.sendCriticalVotingNotification(userId, 'voting_reminder', {
      ...votingData,
      timeRemaining
    });
  }

  // ========================================
  // CRITICAL VOTING EVENTS INTEGRATION
  // ========================================

  /**
   * Notify users about new voting available
   */
  async notifyNewVotingAvailable(userIds: string[], votingData: any) {
    const votingNotificationData = {
      notificationId: `new_voting_${votingData.votingId}_${Date.now()}`,
      title: '🗳️ Nueva Votación Disponible',
      message: `Se ha creado una nueva votación: "${votingData.title}". Tu participación es importante.`,
      type: 'info' as const,
      priority: 'high' as const,
      metadata: {},
      createdAt: new Date(),
      // VotingNotificationData specific fields
      votingId: votingData.votingId,
      assemblyId: votingData.assemblyId,
      assemblyTitle: votingData.assemblyTitle,
      votingTitle: votingData.title,
      relatedData: {
        deadline: votingData.endDate,
      }
    };

    await this.notificationsWebSocketService.notifyNewVoting(userIds, votingNotificationData);
    
    console.log(`✅ New voting notification sent to ${userIds.length} users for voting: ${votingData.title}`);
  }

  /**
   * Notify users about voting deadline approaching
   */
  async notifyVotingDeadlineSoon(userIds: string[], votingData: any, timeRemaining: string) {
    const votingNotificationData = {
      notificationId: `deadline_soon_${votingData.votingId}_${Date.now()}`,
      title: '⏰ Votación Próxima a Cerrar',
      message: `La votación "${votingData.title}" cerrará en ${timeRemaining}. ¡No pierdas la oportunidad de votar!`,
      type: 'warning' as const,
      priority: 'high' as const,
      metadata: {},
      createdAt: new Date(),
      // VotingNotificationData specific fields
      votingId: votingData.votingId,
      assemblyId: votingData.assemblyId,
      assemblyTitle: votingData.assemblyTitle,
      votingTitle: votingData.title,
      relatedData: {
        deadline: votingData.endDate,
        timeRemaining,
      }
    };

    await this.notificationsWebSocketService.notifyVotingDeadlineSoon(userIds, votingNotificationData);
    
    console.log(`✅ Voting deadline notification sent to ${userIds.length} users for voting: ${votingData.title}`);
  }

  /**
   * Notify users that quorum has been reached
   */
  async notifyQuorumReached(userIds: string[], votingData: any, quorumData: any) {
    const votingNotificationData = {
      notificationId: `quorum_reached_${votingData.votingId}_${Date.now()}`,
      title: '✅ Quórum Alcanzado',
      message: `Se ha alcanzado el quórum para la votación "${votingData.title}". La votación puede proceder o cerrarse.`,
      type: 'success' as const,
      priority: 'high' as const,
      metadata: {},
      createdAt: new Date(),
      // VotingNotificationData specific fields
      votingId: votingData.votingId,
      assemblyId: votingData.assemblyId,
      assemblyTitle: votingData.assemblyTitle,
      votingTitle: votingData.title,
      relatedData: {
        currentVotes: quorumData.currentVotes,
        requiredVotes: quorumData.requiredVotes,
      }
    };

    await this.notificationsWebSocketService.notifyQuorumReached(userIds, votingNotificationData);
    
    console.log(`✅ Quorum reached notification sent to ${userIds.length} users for voting: ${votingData.title}`);
  }

  /**
   * Notify users that voting results are available
   */
  async notifyVotingResultsAvailable(userIds: string[], votingData: any, results: any) {
    const votingNotificationData = {
      notificationId: `results_available_${votingData.votingId}_${Date.now()}`,
      title: '📊 Resultados de Votación Disponibles',
      message: `Los resultados de la votación "${votingData.title}" ya están disponibles. Revisa el resultado.`,
      type: 'info' as const,
      priority: 'medium' as const,
      metadata: {},
      createdAt: new Date(),
      // VotingNotificationData specific fields
      votingId: votingData.votingId,
      assemblyId: votingData.assemblyId,
      assemblyTitle: votingData.assemblyTitle,
      votingTitle: votingData.title,
      relatedData: {
        results,
      }
    };

    await this.notificationsWebSocketService.notifyVotingResults(userIds, votingNotificationData);
    
    console.log(`✅ Voting results notification sent to ${userIds.length} users for voting: ${votingData.title}`);
  }

  /**
   * Send critical system notification to specific users
   */
  async sendCriticalSystemNotification(userIds: string[], title: string, message: string, metadata: any = {}) {
    const criticalNotificationData = {
      notificationId: `critical_system_${Date.now()}`,
      title,
      message,
      type: 'error' as const,
      priority: 'critical' as const,
      metadata,
      createdAt: new Date(),
    };

    await this.notificationsWebSocketService.sendCriticalNotification(userIds, criticalNotificationData);
    
    console.log(`🚨 Critical system notification sent to ${userIds.length} users: ${title}`);
  }

  // ...existing code...

  // ========================================
  // HELPER METHODS FOR VOTING NOTIFICATIONS
  // ========================================

  private getVotingNotificationTitle(eventType: string): string {
    switch (eventType) {
      case 'new_voting_available':
        return '🗳️ New Voting Available';
      case 'voting_closing_soon':
        return '⏰ Voting Closing Soon';
      case 'voting_urgent_deadline':
        return '🚨 Urgent: Voting Deadline Approaching';
      case 'quorum_reached':
        return '✅ Quorum Reached';
      case 'voting_results_available':
        return '📊 Voting Results Available';
      case 'voting_reminder':
        return '⏰ Voting Reminder';
      default:
        return '📢 Voting Update';
    }
  }

  private getVotingNotificationMessage(eventType: string, data: any): string {
    switch (eventType) {
      case 'new_voting_available':
        return `A new voting session "${data.title}" is now available. Cast your vote before ${new Date(data.endDate).toLocaleString()}.`;
      case 'voting_closing_soon':
        return `Voting for "${data.title}" will close in ${data.timeRemaining}. Don't miss your chance to vote!`;
      case 'voting_urgent_deadline':
        return `URGENT: Only ${data.timeRemaining} left to vote on "${data.title}". Cast your vote now!`;
      case 'quorum_reached':
        return `Quorum has been reached for "${data.title}". The voting can now proceed or be closed.`;
      case 'voting_results_available':
        return `Results are now available for "${data.title}". Check the outcome of the voting.`;
      case 'voting_reminder':
        return `Reminder: Please cast your vote for "${data.title}". ${data.timeRemaining || 'Time is running out'}.`;
      default:
        return `Update available for voting "${data.title}".`;
    }
  }

  private isVotingEventUrgent(eventType: string): boolean {
    const urgentEvents = [
      'voting_urgent_deadline',
      'voting_closing_soon',
      'quorum_reached'
    ];
    return urgentEvents.includes(eventType);
  }
}
