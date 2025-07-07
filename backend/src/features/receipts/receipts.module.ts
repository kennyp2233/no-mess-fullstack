import { Module } from '@nestjs/common';
import { ReceiptsController } from './controllers/receipts.controller';
import { ReceiptsService } from './services/receipts.service';
import { DatabaseModule } from '../../shared/database';

@Module({
  imports: [DatabaseModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
