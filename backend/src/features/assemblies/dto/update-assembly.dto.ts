import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { AssemblyStatus } from '@prisma/client';

export class UpdateAssemblyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(AssemblyStatus)
  status?: AssemblyStatus;
}

export class UpdateAssemblyStatusDto {
  @IsEnum(AssemblyStatus)
  status: AssemblyStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssemblyResponseDto {
  id: string;
  title: string;
  description?: string;
  date: Date;
  location?: string;
  status: AssemblyStatus;
  houseId: string;
  createdAt: Date;
  updatedAt: Date;
  house: {
    id: string;
    name: string;
  };
  _count?: {
    votings: number;
    proposals: number;
    minutes: number;
  };
}
