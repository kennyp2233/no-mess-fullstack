import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum NotificationType {
  ASSEMBLY_CREATED = 'ASSEMBLY_CREATED',
  ASSEMBLY_REMINDER = 'ASSEMBLY_REMINDER',
  VOTING_STARTED = 'VOTING_STARTED',
  VOTING_ENDED = 'VOTING_ENDED',
  PROPOSAL_CREATED = 'PROPOSAL_CREATED',
  PROPOSAL_APPROVED = 'PROPOSAL_APPROVED',
  PROPOSAL_REJECTED = 'PROPOSAL_REJECTED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_COMPLETED = 'PROJECT_COMPLETED',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_ALERT = 'BUDGET_ALERT',
  MINUTES_PUBLISHED = 'MINUTES_PUBLISHED',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  GENERAL = 'GENERAL',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  entityId?: string; // ID of related entity (assembly, project, etc.)

  @IsString()
  @IsOptional()
  entityType?: string; // Type of related entity

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean = false;

  @IsOptional()
  metadata?: Record<string, any>; // Additional data for templates
}

export class BulkNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsString({ each: true })
  userIds: string[];

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean = false;

  @IsOptional()
  metadata?: Record<string, any>;
}
