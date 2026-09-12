import {
  ForbiddenException,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { PermissionCode } from '../../rbac/permissions.constants';
import {
  AuthenticatedRequest,
} from '../../common/interfaces/authenticated-request.interface';

/**
 * Enforces the permission(s) declared via @RequirePermissions() against the
 * authenticated user's role -> permission grants for THEIR tenant, resolved
 * fresh from the database on every request. This is the actual security
 * boundary — the frontend's route/menu gating is UX only (spec section 11).
 *
 * The highest-precedence matching scope (TENANT > DEPARTMENT > OWN) is
 * attached to the request as `grantedScope` so downstream service code can
 * apply row-level narrowing (e.g. a DEPARTMENT_HEAD only ever seeing their
 * own department's employees) without re-querying permissions itself.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = request;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const grants = await this.prisma.rolePermission.findMany({
      where: {
        permission: { code: { in: required } },
        role: {
          tenantId: user.tenantId,
          code: { in: user.roles },
        },
      },
      select: { scope: true, permission: { select: { code: true } } },
    });

    if (grants.length === 0) {
      throw new ForbiddenException(
        `Missing required permission: ${required.join(', ')}`,
      );
    }

    const scopeRank = { TENANT: 3, DEPARTMENT: 2, OWN: 1 } as const;
    const broadest = grants.reduce((best, g) =>
      scopeRank[g.scope] > scopeRank[best.scope] ? g : best,
    );

    (request as AuthenticatedRequest & { grantedScope?: string }).grantedScope =
      broadest.scope;

    return true;
  }
}
