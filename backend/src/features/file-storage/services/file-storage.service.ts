import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, statSync } from 'fs';

export interface FileUploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  filePath: string;
  url: string;
}

@Injectable()
export class FileStorageService {
  
  /**
   * Process uploaded file and return file information
   */
  async uploadFile(file: Express.Multer.File): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!this.validateFile(file)) {
      throw new BadRequestException('Invalid file type. Only PDF files are allowed.');
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 10MB');
    }

    // Get relative path from uploads directory
    const uploadsDir = join(process.cwd(), 'uploads');
    const relativePath = file.path.replace(uploadsDir, '').replace(/\\/g, '/');
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
      filePath: cleanPath,
      url: `/files/${cleanPath}`,
    };
  }

  /**
   * Get file by relative path from uploads directory
   */
  async getFile(filePath: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const fullPath = join(process.cwd(), 'uploads', cleanPath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }

    try {
      const buffer = readFileSync(fullPath);
      const stats = statSync(fullPath);
      const filename = cleanPath.split('/').pop() || 'download.pdf';

      return {
        buffer,
        mimeType: 'application/pdf',
        filename,
      };
    } catch (error) {
      throw new NotFoundException('Error reading file');
    }
  }

  /**
   * Delete file by relative path
   */
  async deleteFile(filePath: string): Promise<void> {
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const fullPath = join(process.cwd(), 'uploads', cleanPath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }

    try {
      unlinkSync(fullPath);
    } catch (error) {
      throw new BadRequestException('Error deleting file');
    }
  }

  /**
   * Validate file type and other constraints
   */
  validateFile(file: Express.Multer.File): boolean {
    // Check MIME type
    if (file.mimetype !== 'application/pdf') {
      return false;
    }

    // Check file extension
    const allowedExtensions = ['.pdf'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    return allowedExtensions.includes(fileExtension);
  }

  /**
   * Get file info without reading the actual file
   */
  async getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number; mimeType?: string }> {
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const fullPath = join(process.cwd(), 'uploads', cleanPath);

    if (!existsSync(fullPath)) {
      return { exists: false };
    }

    try {
      const stats = statSync(fullPath);
      return {
        exists: true,
        size: stats.size,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      return { exists: false };
    }
  }
}
