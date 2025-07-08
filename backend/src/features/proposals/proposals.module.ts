import { Module } from '@nestjs/common';
import { ProposalsService } from './services/proposals.service';
import { ProposalsController } from './controllers/proposals.controller';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
