import { Module, forwardRef } from '@nestjs/common';
import { NotificationsWebSocketGateway } from './notifications-websocket.gateway';
import { NotificationsWebSocketService } from './notifications-websocket.service';
import { WebSocketModule } from '../../../shared/websockets/websocket.module';
import { DatabaseModule } from '../../../shared/database/database.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    WebSocketModule,
    DatabaseModule,
    AuthModule,
    forwardRef(() => import('../notifications.module').then(m => m.NotificationsModule)),
  ],
  providers: [
    NotificationsWebSocketGateway,
    NotificationsWebSocketService,
  ],
  exports: [
    NotificationsWebSocketService,
  ],
})
export class NotificationsWebSocketModule {}
