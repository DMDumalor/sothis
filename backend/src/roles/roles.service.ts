import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionScope, RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PERMISSION_CATALOG,
  PermissionCode,
  PERMISSIONS,
} from '../rbac/permissions.constants';
import { ROLE_PERMISSION_MATRIX } from '../rbac/role-permission-matrix';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto';

// Removing either of these from ADMIN would let a tenant permanently lock
// itself out of its own permission console — nobody left who can grant
// ROLE_MANAGE/PERMISSION_MANAGE back. Blocked unconditionally, regardless
// of how many other admins exist.
const ADMIN_PROTECTED_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.PERMISSION_MANAGE,
];

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => ({
        code: rp.permission.code as PermissionCode,
        module: rp.permission.module,
        description: rp.permission.description,
        scope: rp.scope,
      })),
    }));
  }

  listPermissionCatalog() {
    return PERMISSION_CATALOG;
  }

  private async getRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRolePermission(params: {
    tenantId: string;
    roleId: string;
    permissionCode: PermissionCode;
    dto: UpdateRolePermissionDto;
    actorUserId: string;
  }) {
    const role = await this.getRole(params.tenantId, params.roleId);
    const permission = await this.prisma.permission.findUnique({
      where: { code: params.permissionCode },
    });
    if (!permission) {
      throw new BadRequestException(
        `Unknown permission code: ${params.permissionCode}`,
      );
    }

    if (
      role.code === RoleCode.ADMIN &&
      !params.dto.granted &&
      ADMIN_PROTECTED_PERMISSIONS.includes(params.permissionCode)
    ) {
      throw new ForbiddenException(
        'This permission cannot be removed from the Admin role — doing so would lock the organization out of its own permission console.',
      );
    }

    if (params.dto.granted) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: { scope: params.dto.scope ?? PermissionScope.TENANT },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          scope: params.dto.scope ?? PermissionScope.TENANT,
        },
      });
    } else {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: permission.id },
      });
    }

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: params.dto.granted
        ? 'role.permission_granted'
        : 'role.permission_revoked',
      resourceType: 'Role',
      resourceId: role.id,
      metadata: {
        roleCode: role.code,
        permissionCode: params.permissionCode,
        scope: params.dto.scope ?? null,
      },
    });

    return this.listRoles(params.tenantId).then((roles) =>
      roles.find((r) => r.id === role.id),
    );
  }

  async resetRoleToDefault(params: {
    tenantId: string;
    roleId: string;
    actorUserId: string;
  }) {
    const role = await this.getRole(params.tenantId, params.roleId);
    const grants = ROLE_PERMISSION_MATRIX[role.code];
    if (!grants) {
      throw new BadRequestException(
        `No default permission set defined for role ${role.code}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      for (const grant of grants) {
        const permission = await tx.permission.findUniqueOrThrow({
          where: { code: grant.permission },
        });
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
            scope: grant.scope,
          },
        });
      }
    });

    await this.audit.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'role.reset_to_default',
      resourceType: 'Role',
      resourceId: role.id,
      metadata: { roleCode: role.code },
    });

    return this.listRoles(params.tenantId).then((roles) =>
      roles.find((r) => r.id === role.id),
    );
  }
}
