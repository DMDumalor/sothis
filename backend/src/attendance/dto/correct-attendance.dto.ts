import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

/** HR manual correction of an attendance record. */
export class CorrectAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
