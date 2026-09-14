import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Used to re-confirm identity before a sensitive account action (disabling
 * MFA, regenerating backup codes) — never trust that a valid access token
 * alone is enough for these. */
export class PasswordConfirmDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
