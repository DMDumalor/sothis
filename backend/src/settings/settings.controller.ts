import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { PasswordConfirmDto } from './dto/password-confirm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Self-service account settings — the page every role's sidebar has always
 * linked to at /settings, which previously had no backend or frontend
 * behind it at all. SETTINGS_READ is granted OWN scope to every role in
 * role-permission-matrix.ts, so every route here just means "you must be
 * logged in"; there is no wider scope to resolve or gate.
 */
@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({
    summary: 'Get your own profile, MFA status, and notification preferences',
  })
  getSettings(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.settingsService.getSettings(user.tenantId, user.userId);
  }

  @Post('password')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Change your own password' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.changePassword({
      tenantId: user.tenantId,
      userId: user.userId,
      dto,
    });
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'List your own active sessions' })
  listSessions(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.settingsService.listSessions(user.tenantId, user.userId);
  }

  @Post('sessions/:sessionId/revoke')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Revoke one of your own sessions' })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.revokeSession({
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId,
    });
  }

  @Post('sessions/revoke-all')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({
    summary: 'Sign out every other session, keeping this one active',
  })
  revokeAllOtherSessions(
    @Body('currentRefreshToken') currentRefreshToken: string | undefined,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.revokeAllOtherSessions({
      tenantId: user.tenantId,
      userId: user.userId,
      currentRefreshToken,
    });
  }

  @Put('notifications')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Update your notification preferences' })
  updateNotificationPreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.updateNotificationPreferences({
      tenantId: user.tenantId,
      userId: user.userId,
      dto,
    });
  }

  @Post('mfa/setup')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({
    summary: 'Begin MFA enrollment: generates a new TOTP secret + QR code',
  })
  async setupMfa(@CurrentUser() user: AuthenticatedPrincipal) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { name: true },
    });
    return this.settingsService.setupMfa({
      tenantId: user.tenantId,
      userId: user.userId,
      email: user.email,
      organizationName: tenant.name,
    });
  }

  @Post('mfa/verify')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({
    summary:
      'Confirm a TOTP code to finish enabling MFA; returns one-time backup codes',
  })
  verifyMfaSetup(
    @Body() dto: VerifyMfaDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.verifyMfaSetup({
      tenantId: user.tenantId,
      userId: user.userId,
      code: dto.code,
    });
  }

  @Post('mfa/disable')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Disable MFA (requires your current password)' })
  disableMfa(
    @Body() dto: PasswordConfirmDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.disableMfa({
      tenantId: user.tenantId,
      userId: user.userId,
      password: dto.password,
    });
  }

  @Post('mfa/backup-codes/regenerate')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({
    summary: 'Invalidate old backup codes and generate a fresh set',
  })
  regenerateBackupCodes(
    @Body() dto: PasswordConfirmDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settingsService.regenerateBackupCodes({
      tenantId: user.tenantId,
      userId: user.userId,
      password: dto.password,
    });
  }
}
