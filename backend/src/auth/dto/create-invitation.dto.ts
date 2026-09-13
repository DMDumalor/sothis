import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RoleCode } from '@prisma/client';

export class CreateInvitationDto {
  @ApiPropertyOptional({
    description:
      'Override the email the invitation is sent to (defaults to the employee record email)',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    enum: RoleCode,
    description:
      'The role the account is granted when the invitation is accepted. Defaults to EMPLOYEE if omitted (the historical behavior).',
  })
  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;
}
