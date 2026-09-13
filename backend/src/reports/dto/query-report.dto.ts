import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryReportDto {
  @ApiPropertyOptional({
    description: 'Inclusive start date (YYYY-MM-DD). Omit for all-time.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date (YYYY-MM-DD). Omit for all-time.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
