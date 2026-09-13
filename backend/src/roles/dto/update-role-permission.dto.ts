import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PermissionScope } from '@prisma/client';

export class UpdateRolePermissionDto {
  @ApiProperty({ description: 'Whether this role should hold the permission' })
  @IsBoolean()
  granted!: boolean;

  @ApiPropertyOptional({
    enum: PermissionScope,
    description:
      'Row-level scope to grant at (defaults to TENANT). Ignored when granted=false.',
  })
  @IsOptional()
  @IsEnum(PermissionScope)
  scope?: PermissionScope;
}
