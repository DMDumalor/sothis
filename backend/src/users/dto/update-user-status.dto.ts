import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const SETTABLE_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type SettableUserStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: SETTABLE_STATUSES,
    description:
      'INVITED/LOCKED are system-managed states and cannot be set directly here — use the unlock action for a locked account.',
  })
  @IsIn(SETTABLE_STATUSES)
  status!: SettableUserStatus;
}
