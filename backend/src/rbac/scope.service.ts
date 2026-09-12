import { Injectable } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * Restriction to narrow a query down to what an OWN or DEPARTMENT-scoped
 * caller is allowed to see. `undefined` fields mean "no restriction on
 * that dimension" — an empty object/undefined restriction overall means
 * TENANT scope (no restriction at all).
 *
 * IMPORTANT for anyone filtering with this: never spread this object into
 * a Prisma `where` that already sets the same key elsewhere (e.g. an
 * explicit `id` for a single-record fetch) — a later spread silently wins
 * over an earlier key, which is exactly the bug that let a self-service
 * employee fetch another employee's record in M2
 * (see employees.service.spec.ts). For a single-record fetch, check
 * `onlyEmployeeId`/`departmentId` against the fetched row in application
 * code instead of folding them into the `where` clause.
 */
export interface EmployeeOwnedScopeRestriction {
  /** Department Head grant: only rows for employees in this department. */
  departmentId?: string;
  /** Employee (self-service) grant: only rows for this one employee. */
  onlyEmployeeId?: string;
}

/**
 * Small shared helper for turning "this caller's grant is DEPARTMENT- or
 * OWN-scoped" into an actual restriction to filter by. Kept in one place
 * so every module (departments, employees, leave, attendance, overtime,
 * ...) resolves "the caller's own department" / "the caller's own
 * employee record" the same way, rather than each controller
 * reimplementing (and potentially diverging on) the same logic.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnDepartmentId(employeeId: string | null): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });
    return employee?.departmentId ?? null;
  }

  /**
   * Resolves the restriction a controller should apply given the scope
   * `PermissionsGuard` granted for the current request. TENANT (or no
   * scope at all, e.g. a permission with only one grantable scope) means
   * no restriction — returns `undefined`.
   */
  async resolveScopeRestriction(
    user: AuthenticatedPrincipal,
    scope?: PermissionScope,
  ): Promise<EmployeeOwnedScopeRestriction | undefined> {
    if (scope === PermissionScope.OWN) {
      // No linked employee record means "can never match anything" rather
      // than "unrestricted" — never fall through to TENANT-wide access.
      return { onlyEmployeeId: user.employeeId ?? '__none__' };
    }
    if (scope === PermissionScope.DEPARTMENT) {
      const departmentId = await this.getOwnDepartmentId(user.employeeId);
      return departmentId ? { departmentId } : { onlyEmployeeId: '__none__' };
    }
    return undefined;
  }
}
