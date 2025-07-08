import { Module, forwardRef } from '@nestjs/common';
import { VotingWebSocketGateway } from './voting-websocket.gateway';
import { VotingWebSocketService } from './voting-websocket.service';
import { WebSocketModule } from '../../../shared/websockets/websocket.module';
import { DatabaseModule } from '../../../shared/database/database.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
    imports: [
        WebSocketModule,
        DatabaseModule,
        AuthModule,
        forwardRef(() => import('../voting.module').then(m => m.VotingModule)),
    ],
    providers: [
        VotingWebSocketGateway,
        VotingWebSocketService,
    ],
    exports: [VotingWebSocketService],
})
export class VotingWebSocketModule { }
