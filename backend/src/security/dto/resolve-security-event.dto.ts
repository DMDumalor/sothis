import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveSecurityEventDto {
  @ApiPropertyOptional({
    description: 'Optional note explaining how this was reviewed/resolved',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolveNote?: string;
}
