import {
  Controller,
  Post,
  Get,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileStorageService } from '../services/file-storage.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../../../shared/decorators';
import { Role } from '@prisma/client';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Upload a PDF file
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.fileStorageService.uploadFile(file);
    return {
      message: 'File uploaded successfully',
      file: result,
    };
  }

  /**
   * Download a file by path
   */
  @Get(':path(*)')
  async getFile(
    @Param('path') filePath: string,
    @Res() res: Response,
    @CurrentUser() user: any
  ) {
    const fileData = await this.fileStorageService.getFile(filePath);

    res.set({
      'Content-Type': fileData.mimeType,
      'Content-Disposition': `inline; filename="${fileData.filename}"`,
      'Content-Length': fileData.buffer.length.toString(),
    });

    res.send(fileData.buffer);
  }

  /**
   * Delete a file by path
   */
  @Delete(':path(*)')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  async deleteFile(
    @Param('path') filePath: string,
    @CurrentUser() user: any
  ) {
    await this.fileStorageService.deleteFile(filePath);
    return {
      message: 'File deleted successfully',
      filePath,
    };
  }

  /**
   * Get file information without downloading
   */
  @Get('info/:path(*)')
  async getFileInfo(
    @Param('path') filePath: string,
    @CurrentUser() user: any
  ) {
    const info = await this.fileStorageService.getFileInfo(filePath);
    return {
      filePath,
      ...info,
    };
  }
}
