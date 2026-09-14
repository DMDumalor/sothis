import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomInt } from 'node:crypto';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function generateBackupCode(): string {
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Self-service account settings — every role holds SETTINGS_READ at OWN
 * scope (see role-permission-matrix.ts), so unlike almost every other
 * service in this codebase there is no ScopeService resolution here: every
 * query below is unconditionally scoped to the calling user's own row.
 * Nothing here is an admin-facing operation; see UsersService for the
 * equivalent admin-over-another-user actions on the same RefreshToken
 * model (each keeps its own small query rather than sharing a helper,
 * since the "self" version also has to know how to keep the caller's own
 * current session alive — see revokeAllOtherSessions).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSettings(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        passwordChangedAt: true,
        createdAt: true,
        tenant: { select: { name: true, code: true, passwordMinLength: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
        userRoles: { select: { role: { select: { code: true, name: true } } } },
        notificationPrefs: {
          select: { category: true, channel: true, enabled: true },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
      passwordChangedAt: user.passwordChangedAt,
      memberSince: user.createdAt,
      organization: user.tenant,
      employee: user.employee,
      roles: user.userRoles.map((ur) => ur.role),
      notificationPreferences: user.notificationPrefs,
    };
  }

  async changePassword(params: {
    tenantId: string;
    userId: string;
    dto: ChangePasswordDto;
  }) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: params.userId, tenantId: params.tenantId },
      include: { tenant: { select: { passwordMinLength: true } } },
    });

    if (
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, params.dto.currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (params.dto.newPassword.length < user.tenant.passwordMinLength) {
      throw new BadRequestException(
        `New password must be at least ${user.tenant.passwordMinLength} characters for this organization.`,
      );
    }

    const passwordHash = await argon2.hash(params.dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: user.id,
      action: 'user.password_changed',
      resourceType: 'User',
      resourceId: user.id,
    });

    return { success: true };
  }

  // -----------------------------------------------------------------
  // Sessions — same underlying RefreshToken model as the admin console's
  // per-user session view, just always scoped to the caller's own id.
  // -----------------------------------------------------------------

  async listSessions(tenantId: string, userId: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdByIp: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(params: {
    tenantId: string;
    userId: string;
    sessionId: string;
  }) {
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: params.sessionId,
        tenantId: params.tenantId,
        userId: params.userId,
      },
    });
    if (!session) {
      throw new BadRequestException('Session not found.');
    }
    if (!session.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.userId,
      action: 'user.session_revoked',
      resourceType: 'User',
      resourceId: params.userId,
      metadata: { sessionId: params.sessionId, self: true },
    });
    return { success: true };
  }

  async revokeAllOtherSessions(params: {
    tenantId: string;
    userId: string;
    currentRefreshToken?: string;
  }) {
    // "Sign out everywhere else" — deliberately keeps the caller's own
    // current session alive (unlike the admin console's revoke-all, which
    // is acting on someone else's account and has no "current session" to
    // preserve) so a user securing their account doesn't lock themselves
    // out mid-action.
    const keepTokenHash = params.currentRefreshToken
      ? createHash('sha256').update(params.currentRefreshToken).digest('hex')
      : undefined;

    await this.prisma.refreshToken.updateMany({
      where: {
        userId: params.userId,
        revokedAt: null,
        ...(keepTokenHash ? { tokenHash: { not: keepTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.userId,
      action: 'user.sessions_revoked_all',
      resourceType: 'User',
      resourceId: params.userId,
      metadata: { self: true },
    });
    return { success: true };
  }

  // -----------------------------------------------------------------
  // Notification preferences — the NotificationPreference model existed
  // in the schema but had no service/controller behind it at all before
  // this; unset (category, channel) pairs default to enabled: true.
  // -----------------------------------------------------------------

  async updateNotificationPreferences(params: {
    tenantId: string;
    userId: string;
    dto: UpdateNotificationPreferencesDto;
  }) {
    await this.prisma.$transaction(
      params.dto.preferences.map((pref) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_category_channel: {
              userId: params.userId,
              category: pref.category,
              channel: pref.channel,
            },
          },
          create: {
            tenantId: params.tenantId,
            userId: params.userId,
            category: pref.category,
            channel: pref.channel,
            enabled: pref.enabled,
          },
          update: { enabled: pref.enabled },
        }),
      ),
    );
    return { success: true };
  }

  // -----------------------------------------------------------------
  // MFA (TOTP) enrollment — real enforcement lives in AuthService.login /
  // completeMfaChallenge, not here; this is purely enrollment/management.
  // -----------------------------------------------------------------

  async setupMfa(params: {
    tenantId: string;
    userId: string;
    email: string;
    organizationName: string;
  }) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: params.userId, tenantId: params.tenantId },
      select: { mfaEnabled: true },
    });
    // Once MFA is actually enabled, a fresh setup call must never silently
    // overwrite the secret the user has already saved to their
    // authenticator app — that would desynchronize the two without ever
    // changing mfaEnabled, permanently locking the user out of TOTP logins
    // (backup codes would still work, but they'd have no way to know why
    // their authenticator suddenly stopped working). Disable first, which
    // clears the secret, then setup can start clean.
    if (user.mfaEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled. Disable it before setting it up again.',
      );
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: params.organizationName,
      label: params.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Stored immediately as a "pending" secret — mfaEnabled stays false
    // until verifyMfa confirms the user can actually generate valid codes
    // with it. If they abandon setup, a later setupMfa call simply
    // overwrites this with a fresh secret.
    await this.prisma.user.update({
      where: { id: params.userId },
      data: { mfaSecret: secret },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verifyMfaSetup(params: {
    tenantId: string;
    userId: string;
    code: string;
  }) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: params.userId, tenantId: params.tenantId },
    });
    if (!user.mfaSecret) {
      throw new BadRequestException('Start MFA setup before verifying a code.');
    }
    if (user.mfaEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled.',
      );
    }

    const result = await verifyTotp({
      secret: user.mfaSecret,
      token: params.code.trim(),
      epochTolerance: 1,
    }).catch(() => ({ valid: false }));

    if (!result.valid) {
      throw new BadRequestException(
        'That code is incorrect or has expired. Please try again.',
      );
    }

    const backupCodes = Array.from({ length: 8 }, generateBackupCode);
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c)),
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaBackupCodes: hashedCodes },
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: user.id,
      action: 'user.mfa_enabled',
      resourceType: 'User',
      resourceId: user.id,
    });

    return { success: true, backupCodes };
  }

  async disableMfa(params: {
    tenantId: string;
    userId: string;
    password: string;
  }) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: params.userId, tenantId: params.tenantId },
    });
    if (
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, params.password))
    ) {
      throw new UnauthorizedException('Password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: user.id,
      action: 'user.mfa_disabled',
      resourceType: 'User',
      resourceId: user.id,
    });

    return { success: true };
  }

  async regenerateBackupCodes(params: {
    tenantId: string;
    userId: string;
    password: string;
  }) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: params.userId, tenantId: params.tenantId },
    });
    if (!user.mfaEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is not enabled.',
      );
    }
    if (
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, params.password))
    ) {
      throw new UnauthorizedException('Password is incorrect.');
    }

    const backupCodes = Array.from({ length: 8 }, generateBackupCode);
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c)),
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaBackupCodes: hashedCodes },
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: user.id,
      action: 'user.mfa_backup_codes_regenerated',
      resourceType: 'User',
      resourceId: user.id,
    });

    return { success: true, backupCodes };
  }
}
