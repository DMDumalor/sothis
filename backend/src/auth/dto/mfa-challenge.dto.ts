import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class MfaChallengeDto {
  @ApiProperty({
    description:
      'The mfaToken returned by /auth/login when mfaRequired is true',
  })
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @ApiProperty({
    description: 'A 6-digit TOTP code, or an 8-character backup code',
    example: '123456',
  })
  @IsString()
  @Length(6, 12)
  code!: string;
}
