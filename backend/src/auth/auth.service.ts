import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import {
  InvitationStatus,
  LoginAuditResult,
  RoleCode,
  SecuritySeverity,
  SecurityEventType,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly GENERIC_LOGIN_ERROR =
    'Invalid organization code, email, or password.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta) {
    const organizationCode = dto.organizationCode.trim().toUpperCase();
    const email = dto.email.trim().toLowerCase();

    const tenant = await this.prisma.tenant.findUnique({
      where: { code: organizationCode },
    });

    if (!tenant || !tenant.isActive) {
      await this.logLoginAttempt({
        tenantId: null,
        userId: null,
        emailAttempt: email,
        organizationCodeAttempt: organizationCode,
        result: LoginAuditResult.TENANT_NOT_FOUND,
        meta,
      });
      throw new UnauthorizedException(this.GENERIC_LOGIN_ERROR);
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: {
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });

    if (!user) {
      await this.logLoginAttempt({
        tenantId: tenant.id,
        userId: null,
        emailAttempt: email,
        organizationCodeAttempt: organizationCode,
        result: LoginAuditResult.INVALID_CREDENTIALS,
        meta,
      });
      throw new UnauthorizedException(this.GENERIC_LOGIN_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logLoginAttempt({
        tenantId: tenant.id,
        userId: user.id,
        emailAttempt: email,
        organizationCodeAttempt: organizationCode,
        result: LoginAuditResult.ACCOUNT_LOCKED,
        meta,
      });
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new HttpException(
        `Too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (user.status === UserStatus.DISABLED) {
      await this.logLoginAttempt({
        tenantId: tenant.id,
        userId: user.id,
        emailAttempt: email,
        organizationCodeAttempt: organizationCode,
        result: LoginAuditResult.ACCOUNT_DISABLED,
        meta,
      });
      throw new UnauthorizedException(this.GENERIC_LOGIN_ERROR);
    }

    if (user.status === UserStatus.INVITED || !user.passwordHash) {
      await this.logLoginAttempt({
        tenantId: tenant.id,
        userId: user.id,
        emailAttempt: email,
        organizationCodeAttempt: organizationCode,
        result: LoginAuditResult.ACCOUNT_NOT_ACTIVATED,
        meta,
      });
      throw new UnauthorizedException(this.GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.handleFailedPassword(
        user.id,
        tenant.id,
        email,
        organizationCode,
        tenant.lockoutMaxAttempts,
        tenant.lockoutDurationMinutes,
        meta,
      );
      throw new UnauthorizedException(this.GENERIC_LOGIN_ERROR);
    }

    // Success: atomically clear lockout counters and stamp lastLoginAt.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.logLoginAttempt({
      tenantId: tenant.id,
      userId: user.id,
      emailAttempt: email,
      organizationCodeAttempt: organizationCode,
      result: LoginAuditResult.SUCCESS,
      meta,
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const issued = await this.tokens.issueTokenPair({
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      roles,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      refreshTokenTtlDays: tenant.refreshTokenTtlDays,
    });

    return {
      ...issued,
      user: {
        id: user.id,
        email: user.email,
        roles,
        organizationCode: tenant.code,
        organizationName: tenant.name,
      },
    };
  }

  private async handleFailedPassword(
    userId: string,
    tenantId: string,
    email: string,
    organizationCode: string,
    maxAttempts: number,
    lockoutMinutes: number,
    meta: RequestMeta,
  ) {
    // Atomic increment avoids a lost-update race between concurrent failed
    // attempts from the same account.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    let result: LoginAuditResult = LoginAuditResult.INVALID_CREDENTIALS;

    if (updated.failedLoginAttempts >= maxAttempts) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000),
        },
      });
      result = LoginAuditResult.ACCOUNT_LOCKED;
      await this.audit.recordSecurityEvent({
        tenantId,
        type: SecurityEventType.ACCOUNT_LOCKOUT,
        severity: SecuritySeverity.MEDIUM,
        description: `Account locked after ${updated.failedLoginAttempts} failed login attempts.`,
        userId,
        ipAddress: meta.ipAddress,
      });
    }

    await this.logLoginAttempt({
      tenantId,
      userId,
      emailAttempt: email,
      organizationCodeAttempt: organizationCode,
      result,
      meta,
    });
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const issued = await this.tokens.rotateRefreshToken({
      refreshToken,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.logLoginAttempt({
      tenantId: issued.tenantId,
      userId: issued.userId,
      emailAttempt: '',
      organizationCodeAttempt: null,
      result: LoginAuditResult.REFRESH,
      meta,
    });
    return issued;
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeToken(refreshToken);
  }

  // ---------------------------------------------------------------------
  // Account invitations (spec section 10)
  // ---------------------------------------------------------------------

  async createInvitation(params: {
    tenantId: string;
    employeeId: string;
    invitedById: string;
    emailOverride?: string;
    organizationCode: string;
    invitedByName: string;
    roleCode?: RoleCode;
  }) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: params.employeeId, tenantId: params.tenantId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (employee.userId) {
      throw new ConflictException('Employee already has an account');
    }

    const email = (params.emailOverride ?? employee.email).trim().toLowerCase();
    const token = randomBytes(32).toString('base64url');
    const expiresInDays = this.config.get<number>(
      'security.invitationExpiresInDays',
    )!;
    // Defaults to EMPLOYEE — the historical behavior for every invitation
    // issued before intendedRoleCode existed, and the safe default for
    // HR's employee-invite flow (which never asked for a role).
    const intendedRoleCode = params.roleCode ?? RoleCode.EMPLOYEE;

    // Revoke any still-pending invitation for this employee before issuing a new one.
    await this.prisma.accountInvitation.updateMany({
      where: { employeeId: employee.id, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });

    const invitation = await this.prisma.accountInvitation.create({
      data: {
        tenantId: params.tenantId,
        employeeId: employee.id,
        email,
        tokenHash: hashToken(token),
        intendedRoleCode,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        invitedById: params.invitedById,
      },
    });

    const activationUrl = `${this.config.get<string>('urls.frontend')}/activate?token=${token}`;
    await this.mail.sendAccountInvitation({
      to: email,
      organizationCode: params.organizationCode,
      activationUrl,
      invitedByName: params.invitedByName,
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.invitedById,
      action: 'employee.account_invitation.created',
      resourceType: 'Employee',
      resourceId: employee.id,
      metadata: { intendedRoleCode },
    });

    return {
      id: invitation.id,
      email,
      expiresAt: invitation.expiresAt,
      intendedRoleCode,
    };
  }

  async revokeInvitation(params: {
    tenantId: string;
    invitationId: string;
    actorUserId: string;
  }) {
    const invitation = await this.prisma.accountInvitation.findFirst({
      where: { id: params.invitationId, tenantId: params.tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.accountInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });
    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'employee.account_invitation.revoked',
      resourceType: 'AccountInvitation',
      resourceId: invitation.id,
    });
  }

  async acceptInvitation(dto: AcceptInvitationDto, meta: RequestMeta) {
    const tokenHash = hashToken(dto.token);
    const invitation = await this.prisma.accountInvitation.findUnique({
      where: { tokenHash },
      include: { employee: true, tenant: true },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'This invitation link is invalid or has expired.',
      );
    }

    // AcceptInvitationDto's @MinLength(10) is the platform-wide floor; an
    // Admin can only raise it further via Organization Settings, never
    // lower it below what the DTO already enforces.
    if (dto.password.length < invitation.tenant.passwordMinLength) {
      throw new BadRequestException(
        `password must be at least ${invitation.tenant.passwordMinLength} characters for this organization`,
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          passwordHash,
          status: UserStatus.ACTIVE,
          passwordChangedAt: new Date(),
        },
      });

      // The invitation records the role it was issued for (defaults to
      // EMPLOYEE for invitations that predate this field) — never
      // hardcode EMPLOYEE here, or a Department Head/Finance/etc. invite
      // would silently downgrade to a plain Employee on acceptance.
      const grantedRole = await tx.role.findUnique({
        where: {
          tenantId_code: {
            tenantId: invitation.tenantId,
            code: invitation.intendedRoleCode ?? RoleCode.EMPLOYEE,
          },
        },
      });
      if (grantedRole) {
        await tx.userRole.create({
          data: { userId: createdUser.id, roleId: grantedRole.id },
        });
      }

      await tx.employee.update({
        where: { id: invitation.employeeId },
        data: { userId: createdUser.id },
      });

      await tx.accountInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });

      return createdUser;
    });

    await this.audit.record({
      tenantId: invitation.tenantId,
      actorUserId: user.id,
      action: 'employee.account_activated',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: meta.ipAddress,
    });

    return { success: true, organizationCode: invitation.tenant.code };
  }

  private async logLoginAttempt(params: {
    tenantId: string | null;
    userId: string | null;
    emailAttempt: string;
    organizationCodeAttempt: string | null;
    result: LoginAuditResult;
    meta: RequestMeta;
  }) {
    await this.prisma.loginAudit
      .create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          emailAttempt: params.emailAttempt,
          organizationCodeAttempt: params.organizationCodeAttempt,
          result: params.result,
          ipAddress: params.meta.ipAddress,
          userAgent: params.meta.userAgent,
        },
      })
      .catch((error) =>
        this.logger.error(`Failed to write login audit: ${error}`),
      );
  }
}
