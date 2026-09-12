import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateInvitationDto {
  @ApiPropertyOptional({
    description: 'Override the email the invitation is sent to (defaults to the employee record email)',
  })
  @IsOptional()
  @IsString()
  email?: string;
}
