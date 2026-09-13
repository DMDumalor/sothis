import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { InsightCategory, InsightStatus, RiskLevel } from '@prisma/client';

export class QueryInsightsDto {
  @ApiPropertyOptional({ enum: InsightCategory })
  @IsOptional()
  @IsEnum(InsightCategory)
  category?: InsightCategory;

  @ApiPropertyOptional({ enum: InsightStatus })
  @IsOptional()
  @IsEnum(InsightStatus)
  status?: InsightStatus;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
