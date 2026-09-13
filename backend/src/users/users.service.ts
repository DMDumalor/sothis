import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, Prisma, RoleCode, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { SettableUserStatus } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  status: true,
  mfaEnabled: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
    },
  },
  userRoles: {
    select: { role: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  async list(tenantId: string, query: QueryUsersDto) {
    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role
        ? { userRoles: { some: { role: { code: query.role } } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              {
                employee: {
                  firstName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  lastName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  employeeCode: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: users,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: USER_LIST_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async countActiveAdmins(
    tenantId: string,
    excludingUserId?: string,
  ): Promise<number> {
    return this.prisma.user.count({
      where: {
        tenantId,
        status: UserStatus.ACTIVE,
        id: excludingUserId ? { not: excludingUserId } : undefined,
        userRoles: { some: { role: { code: RoleCode.ADMIN } } },
      },
    });
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { code: RoleCode.ADMIN } },
    });
    return count > 0;
  }

  async updateStatus(params: {
    tenantId: string;
    id: string;
    status: SettableUserStatus;
    actorUserId: string;
  }) {
    const user = await this.findOne(params.tenantId, params.id);

    if (params.id === params.actorUserId && params.status === 'DISABLED') {
      throw new BadRequestException('You cannot disable your own account.');
    }

    if (params.status === 'DISABLED' && (await this.isAdmin(params.id))) {
      const remainingAdmins = await this.countActiveAdmins(
        params.tenantId,
        params.id,
      );
      if (remainingAdmins === 0) {
        throw new ForbiddenException(
          'Cannot disable the last active administrator for this organization.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: params.status,
        ...(params.status === 'ACTIVE'
          ? { failedLoginAttempts: 0, lockedUntil: null }
          : {}),
      },
      select: USER_LIST_SELECT,
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: params.status === 'ACTIVE' ? 'user.enabled' : 'user.disabled',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email },
    });

    return updated;
  }

  async unlock(params: { tenantId: string; id: string; actorUserId: string }) {
    const user = await this.findOne(params.tenantId, params.id);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: USER_LIST_SELECT,
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'user.unlocked',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email },
    });

    return updated;
  }

  async updateRoles(params: {
    tenantId: string;
    id: string;
    dto: UpdateUserRolesDto;
    actorUserId: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: { id: params.id, tenantId: params.tenantId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wasAdmin = user.userRoles.some(
      (ur) => ur.role.code === RoleCode.ADMIN,
    );
    const willBeAdmin = params.dto.roleCodes.includes(RoleCode.ADMIN);
    if (wasAdmin && !willBeAdmin) {
      const remainingAdmins = await this.countActiveAdmins(
        params.tenantId,
        params.id,
      );
      if (remainingAdmins === 0) {
        throw new ForbiddenException(
          'Cannot remove the ADMIN role from the last active administrator.',
        );
      }
    }

    const roles = await this.prisma.role.findMany({
      where: { tenantId: params.tenantId, code: { in: params.dto.roleCodes } },
    });
    if (roles.length !== params.dto.roleCodes.length) {
      throw new BadRequestException(
        'One or more roles could not be resolved for this organization.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: user.id } }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
      }),
    ]);

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'user.roles_updated',
      resourceType: 'User',
      resourceId: user.id,
      metadata: {
        previousRoles: user.userRoles.map((ur) => ur.role.code),
        newRoles: params.dto.roleCodes,
      },
    });

    return this.findOne(params.tenantId, params.id);
  }

  async listEmployeesWithoutAccount(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, userId: null },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async listInvitations(tenantId: string) {
    return this.prisma.accountInvitation.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        status: true,
        intendedRoleCode: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        invitedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async inviteUser(params: {
    tenantId: string;
    dto: InviteUserDto;
    actorUserId: string;
    actorEmail: string;
    actorEmployeeName: string | null;
    organizationCode: string;
  }) {
    const result = await this.authService.createInvitation({
      tenantId: params.tenantId,
      employeeId: params.dto.employeeId,
      invitedById: params.actorUserId,
      emailOverride: params.dto.email,
      roleCode: params.dto.roleCode,
      organizationCode: params.organizationCode,
      invitedByName: params.actorEmployeeName ?? params.actorEmail,
    });
    return result;
  }

  async revokeInvitation(params: {
    tenantId: string;
    invitationId: string;
    actorUserId: string;
  }) {
    await this.authService.revokeInvitation({
      tenantId: params.tenantId,
      invitationId: params.invitationId,
      actorUserId: params.actorUserId,
    });
    return { success: true };
  }

  async resendInvitation(params: {
    tenantId: string;
    invitationId: string;
    actorUserId: string;
    actorEmail: string;
    actorEmployeeName: string | null;
    organizationCode: string;
  }) {
    const invitation = await this.prisma.accountInvitation.findFirst({
      where: { id: params.invitationId, tenantId: params.tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Only pending invitations can be resent.');
    }

    // Resending simply re-issues a fresh invitation for the same employee —
    // createInvitation already revokes any still-pending prior invitation.
    return this.authService.createInvitation({
      tenantId: params.tenantId,
      employeeId: invitation.employeeId,
      invitedById: params.actorUserId,
      emailOverride: invitation.email,
      roleCode: invitation.intendedRoleCode ?? undefined,
      organizationCode: params.organizationCode,
      invitedByName: params.actorEmployeeName ?? params.actorEmail,
    });
  }
}
