import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePayrollPeriodDto {
  @ApiPropertyOptional({ description: 'Defaults to "<Month> <Year>" derived from periodStart if omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiProperty({ description: 'YYYY-MM-DD, inclusive' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'YYYY-MM-DD, inclusive' })
  @IsDateString()
  periodEnd!: string;
}
