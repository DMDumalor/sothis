import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RoleCode } from '@prisma/client';

export class BulkInviteEntryDto {
  @ApiProperty({
    description:
      'The employee this account belongs to (must not already have an account)',
  })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({
    enum: RoleCode,
    description: 'The role the account is granted once activated',
  })
  @IsEnum(RoleCode)
  roleCode!: RoleCode;

  @ApiPropertyOptional({
    description:
      "Override the email the invitation is sent to (defaults to the employee record's email)",
  })
  @IsOptional()
  @IsString()
  email?: string;
}

export class BulkInviteUsersDto {
  @ApiProperty({ type: [BulkInviteEntryDto] })
  @ValidateNested({ each: true })
  @Type(() => BulkInviteEntryDto)
  @ArrayMinSize(1, { message: 'Provide at least one invitation.' })
  @ArrayMaxSize(200, {
    message: 'A single batch is limited to 200 invitations.',
  })
  invitations!: BulkInviteEntryDto[];
}
