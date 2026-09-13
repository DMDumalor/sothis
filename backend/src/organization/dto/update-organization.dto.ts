import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

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
}
