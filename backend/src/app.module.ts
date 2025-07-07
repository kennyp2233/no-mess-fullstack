import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/database';
import { AuthModule } from './features/auth/auth.module';
import { HousesModule } from './features/houses/houses.module';
import { ReceiptsModule } from './features/receipts/receipts.module';
import { FileStorageModule } from './features/file-storage/file-storage.module';

@Module({
  imports: [DatabaseModule, AuthModule, HousesModule, ReceiptsModule, FileStorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
