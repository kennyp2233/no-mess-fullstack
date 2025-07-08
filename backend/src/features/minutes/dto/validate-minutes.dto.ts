import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ValidateMinutesDto {
  @IsString()
  @IsNotEmpty()
  validatedBy: string;

  @IsString()
  @IsOptional()
  validationNotes?: string;
}
