import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsEnum } from 'class-validator';
import { RoleCode } from '@prisma/client';

export class UpdateUserRolesDto {
  @ApiProperty({
    enum: RoleCode,
    isArray: true,
    description:
      'The full set of roles this user should have — replaces the existing assignment.',
  })
  @IsEnum(RoleCode, { each: true })
  @ArrayUnique()
  @ArrayMinSize(1, { message: 'A user must have at least one role.' })
  roleCodes!: RoleCode[];
}
