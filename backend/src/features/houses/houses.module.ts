import { Module } from '@nestjs/common';
import { HousesService } from './services/houses.service';
import { HousesController } from './controllers/houses.controller';

@Module({
  controllers: [HousesController],
  providers: [HousesService],
  exports: [HousesService],
})
export class HousesModule {}
