import { Module } from '@nestjs/common';
import { AssembliesController } from './controllers/assemblies.controller';
import { AssembliesService } from './services/assemblies.service';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AssembliesController],
  providers: [AssembliesService],
  exports: [AssembliesService],
})
export class AssembliesModule {}
