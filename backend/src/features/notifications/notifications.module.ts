import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { NotificationsWebSocketModule } from './websockets/notifications-websocket.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsWebSocketModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService, NotificationsWebSocketModule],
})
export class NotificationsModule {}
