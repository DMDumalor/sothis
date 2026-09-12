import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateOvertimeDto {
  @ApiProperty({ description: 'The date the overtime was worked (YYYY-MM-DD)' })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attendanceRecordId?: string;
}
