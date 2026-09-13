import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REVIEW_TARGET_STATUSES = [
  'UNDER_REVIEW',
  'REVIEWED',
  'DISMISSED',
] as const;
export type ReviewTargetStatus = (typeof REVIEW_TARGET_STATUSES)[number];

export class ReviewInsightDto {
  @ApiProperty({
    enum: REVIEW_TARGET_STATUSES,
    description: 'The human-review decision for this insight',
  })
  @IsIn(REVIEW_TARGET_STATUSES)
  status!: ReviewTargetStatus;

  @ApiPropertyOptional({ description: 'Why the reviewer made this decision' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
