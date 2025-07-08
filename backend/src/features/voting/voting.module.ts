import { Module, forwardRef } from '@nestjs/common';
import { 
  VotingService,
  VotingStatsService,
  VotingQuorumService,
  VotingNotificationService,
  VotingSchedulerService
} from './services';
import { VotingController } from './controllers/voting.controller';
import { DatabaseModule } from '../../shared/database/database.module';
import { VotingWebSocketModule } from './websockets/voting-websocket.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => VotingWebSocketModule),
  ],
  controllers: [VotingController],
  providers: [
    VotingService,
    VotingStatsService,
    VotingQuorumService,
    VotingNotificationService,
    VotingSchedulerService
  ],
  exports: [
    VotingService,
    VotingStatsService,
    VotingQuorumService,
    VotingNotificationService,
    VotingSchedulerService
  ],
})
export class VotingModule {}
