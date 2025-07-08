import { Module, Global } from '@nestjs/common';
import { AppWebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { WsJwtStrategy } from './ws-jwt.strategy';
import { WsAuthGuard } from './ws-auth.guard';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../../features/auth/auth.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
  ],
  providers: [AppWebSocketGateway, WebSocketService, WsJwtStrategy, WsAuthGuard],
  exports: [WebSocketService, WsAuthGuard],
})
export class WebSocketModule {}
