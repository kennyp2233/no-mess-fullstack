import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreateMinutesDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attendees?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  decisions?: string[];

  @IsString()
  @IsNotEmpty()
  assemblyId: string;
}
