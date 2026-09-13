import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RoleCode } from '@prisma/client';

export class InviteUserDto {
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
      'Override the email the invitation is sent to (defaults to the employee record email)',
  })
  @IsOptional()
  @IsString()
  email?: string;
}
