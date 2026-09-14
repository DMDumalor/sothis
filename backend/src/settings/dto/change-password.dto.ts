import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  // The platform-wide floor; a tenant's own passwordMinLength (Organization
  // Settings) is enforced dynamically in SettingsService on top of this.
  @ApiProperty()
  @IsString()
  @MinLength(10)
  newPassword!: string;
}
