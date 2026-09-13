import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Display name of the organization' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'IANA timezone, e.g. "Africa/Lagos"' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Logo image URL' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  // Note: `code` (the organization login code) is intentionally NOT
  // editable here — it is the tenant's immutable login identifier, baked
  // into every user's expectations and any external references.

  // --- Security policy (spec section 14/51) ---------------------------
  // These are genuinely enforced by AuthService/TokenService (see
  // auth.service.ts and token.service.ts), not cosmetic settings.

  @ApiPropertyOptional({
    description:
      'Minimum accepted password length on account activation. AcceptInvitationDto already enforces a hard floor of 10 characters — this can only raise that bar, never lower it.',
    minimum: 10,
    maximum: 64,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(64)
  passwordMinLength?: number;

  @ApiPropertyOptional({
    description:
      'Failed login attempts before an account is temporarily locked.',
    minimum: 3,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  lockoutMaxAttempts?: number;

  @ApiPropertyOptional({
    description:
      'How long an account stays locked after exceeding the attempt threshold.',
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  lockoutDurationMinutes?: number;

  @ApiPropertyOptional({
    description:
      'How long a refresh token (and therefore a signed-in session) stays valid before requiring a fresh login.',
    minimum: 1,
    maximum: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  refreshTokenTtlDays?: number;
}
