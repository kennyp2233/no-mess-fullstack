import { Module } from '@nestjs/common';
import { BudgetController } from './controllers/budget.controller';
import { BudgetService } from './services/budget.service';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
