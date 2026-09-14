import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Needed for PermissionsGuard (JwtAuthGuard is already global via
  // AuthModule's APP_GUARD registration) — same pattern as every other
  // module whose controller uses @UseGuards(JwtAuthGuard, PermissionsGuard).
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
