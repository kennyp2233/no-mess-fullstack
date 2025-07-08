import { Module } from '@nestjs/common';
import { MinutesController } from './controllers/minutes.controller';
import { MinutesService } from './services/minutes.service';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MinutesController],
  providers: [MinutesService],
  exports: [MinutesService],
})
export class MinutesModule {}
