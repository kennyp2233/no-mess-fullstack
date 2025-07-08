import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/database';
import { SharedServicesModule } from './shared/services';
import { WebSocketModule } from './shared/websockets/websocket.module';
import { AuthModule } from './features/auth/auth.module';
import { HousesModule } from './features/houses/houses.module';
import { TransactionsModule } from './features/transactions/transactions.module';
import { FileStorageModule } from './features/file-storage/file-storage.module';
import { AccountsModule } from './features/accounts/accounts.module';
import { ProjectsModule } from './features/projects/projects.module';
import { AssembliesModule } from './features/assemblies/assemblies.module';
import { VotingModule } from './features/voting/voting.module';
import { ProposalsModule } from './features/proposals/proposals.module';
import { MinutesModule } from './features/minutes/minutes.module';
import { BudgetModule } from './features/budget/budget.module';
import { NotificationsModule } from './features/notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule, 
    SharedServicesModule,
    WebSocketModule,
    AuthModule, 
    HousesModule, 
    TransactionsModule, 
    FileStorageModule, 
    AccountsModule, 
    ProjectsModule, 
    AssembliesModule, 
    VotingModule, 
    ProposalsModule,
    MinutesModule,
    BudgetModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
