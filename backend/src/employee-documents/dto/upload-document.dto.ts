import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type!: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
