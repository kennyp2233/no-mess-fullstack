import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDate } from 'class-validator';

export class UploadFileDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class FileResponseDto {
  @IsString()
  filename: string;

  @IsString()
  originalName: string;

  @IsNumber()
  size: number;

  @IsString()
  mimeType: string;

  @IsDate()
  uploadedAt: Date;

  @IsString()
  filePath: string;

  @IsString()
  url: string;
}

export class FileInfoDto {
  @IsString()
  filePath: string;

  @IsString()
  exists: boolean;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
