import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { FileStorageController } from './controllers/file-storage.controller';
import { FileStorageService } from './services/file-storage.service';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const uploadPath = join(process.cwd(), 'uploads', String(year), month);
          
          // Create directory if it doesn't exist
          const fs = require('fs');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 15);
          const extension = extname(file.originalname);
          const filename = `${timestamp}_${randomString}${extension}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        // Only allow PDF files
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [FileStorageController],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
