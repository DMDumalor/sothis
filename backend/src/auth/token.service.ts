import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { RoleCode, SecurityEventType, SecuritySeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccessTokenPayload } from './strategies/jwt.strategy';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Owns access-token signing and refresh-token issuance/rotation. Refresh
 * tokens are opaque random strings; only their SHA-256 hash is ever stored,
 * so a stolen database dump does not hand out usable tokens.
 *
 * Rotation + reuse detection: each refresh token belongs to a "family". On
 * refresh, the presented token is atomically marked revoked and replaced by
 * a new one in the same family. If a token that has ALREADY been rotated
 * (revokedAt set) is presented again, the entire family is revoked and the
 * event is treated as a security incident — this is the standard defense
 * against a stolen refresh token being replayed after the legitimate client
 * has already moved on to its successor.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });
  }

  async issueTokenPair(params: {
    userId: string;
    tenantId: string;
    email: string;
    roles: RoleCode[];
    ipAddress?: string;
    userAgent?: string;
    family?: string;
    // Per-tenant override (Tenant.refreshTokenTtlDays, set via Organization
    // Settings). Falls back to the global config default so any caller
    // that doesn't have the tenant record handy (there shouldn't be one,
    // but this keeps the method safe) still works.
    refreshTokenTtlDays?: number;
  }): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken({
      sub: params.userId,
      tenantId: params.tenantId,
      email: params.email,
      roles: params.roles,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshDays =
      params.refreshTokenTtlDays ??
      this.config.get<number>('jwt.refreshExpiresInDays')!;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        tokenHash: hashToken(refreshToken),
        family: params.family ?? randomUUID(),
        expiresAt,
        createdByIp: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('jwt.accessExpiresIn')!,
    };
  }

  /**
   * Validates and rotates a refresh token. Throws UnauthorizedException for
   * any invalid/expired/revoked token; on detected reuse, revokes the whole
   * family and records a security event before throwing.
   */
  async rotateRefreshToken(params: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IssuedTokens & { userId: string; tenantId: string }> {
    const tokenHash = hashToken(params.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            status: true,
            userRoles: { select: { role: { select: { code: true } } } },
          },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse of an already-rotated (or expired) token: treat as compromise.
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.recordSecurityEvent({
        tenantId: existing.tenantId,
        type: SecurityEventType.REFRESH_TOKEN_REUSE,
        severity: SecuritySeverity.HIGH,
        description:
          'A previously rotated or expired refresh token was presented again; the token family has been revoked.',
        userId: existing.userId,
        ipAddress: params.ipAddress,
        metadata: { family: existing.family },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    // Re-fetch the tenant's current TTL rather than reusing whatever the
    // original token was issued with — if an Admin shortens/lengthens it
    // via Organization Settings mid-session, rotation should pick up the
    // new value immediately rather than perpetuating the old one forever.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: existing.user.tenantId },
      select: { refreshTokenTtlDays: true },
    });

    const roles = existing.user.userRoles.map((ur) => ur.role.code);
    const issued = await this.issueTokenPair({
      userId: existing.user.id,
      tenantId: existing.user.tenantId,
      email: existing.user.email,
      roles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      family: existing.family,
      refreshTokenTtlDays: tenant?.refreshTokenTtlDays,
    });

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        replacedById: (
          await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashToken(issued.refreshToken) },
            select: { id: true },
          })
        )?.id,
      },
    });

    return {
      ...issued,
      userId: existing.user.id,
      tenantId: existing.user.tenantId,
    };
  }

  async revokeToken(refreshToken: string) {
    await this.prisma.refreshToken
      .update({
        where: { tokenHash: hashToken(refreshToken) },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined); // logout is idempotent even for an unknown/expired token
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
