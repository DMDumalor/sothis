import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../rbac/permissions.constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares which permission(s) a route requires. Enforced server-side by
 * PermissionsGuard — frontend menu visibility must never be relied on for
 * authorization (spec section 11).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
