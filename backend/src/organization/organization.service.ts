import { Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Organization not found');
    }

    const [
      employeeCount,
      activeUserCount,
      departmentCount,
      pendingInvitationCount,
      roleBreakdown,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.user.count({
        where: { tenantId, status: UserStatus.ACTIVE },
      }),
      this.prisma.department.count({ where: { tenantId } }),
      this.prisma.accountInvitation.count({
        where: { tenantId, status: InvitationStatus.PENDING },
      }),
      this.prisma.role.findMany({
        where: { tenantId },
        select: {
          code: true,
          name: true,
          _count: { select: { userRoles: true } },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      isActive: tenant.isActive,
      timezone: tenant.timezone,
      logoUrl: tenant.logoUrl,
      createdAt: tenant.createdAt,
      stats: {
        employeeCount,
        activeUserCount,
        departmentCount,
        pendingInvitationCount,
        roleBreakdown: roleBreakdown.map((r) => ({
          code: r.code,
          name: r.name,
          userCount: r._count.userRoles,
        })),
      },
    };
  }

  async updateProfile(params: {
    tenantId: string;
    dto: UpdateOrganizationDto;
    actorUserId: string;
  }) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: params.tenantId },
      data: params.dto,
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'organization.updated',
      resourceType: 'Tenant',
      resourceId: tenant.id,
      metadata: { changes: JSON.parse(JSON.stringify(params.dto)) },
    });

    return this.getProfile(params.tenantId);
  }
}
