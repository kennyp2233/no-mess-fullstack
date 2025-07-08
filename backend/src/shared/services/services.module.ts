import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BusinessRulesService } from './business-rules.service';
import { WorkflowService } from './workflow.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [BusinessRulesService, WorkflowService],
  exports: [BusinessRulesService, WorkflowService],
})
export class SharedServicesModule {}
