import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'SOTHIS-1618' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9-]+$/i, {
    message: 'organizationCode may only contain letters, numbers and dashes',
  })
  organizationCode!: string;

  @ApiProperty({ example: 'hr.manager@sothis1618.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
