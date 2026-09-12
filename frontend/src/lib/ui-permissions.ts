import type { RoleCode } from '@/types/auth';

/**
 * UI-only convenience checks mirroring the backend's role → permission
 * matrix (src/rbac/role-permission-matrix.ts) — used ONLY to decide
 * whether to render an action (e.g. an "Add Employee" button). This is
 * never the authorization boundary: every mutating request is
 * independently re-checked server-side by PermissionsGuard, and a 403
 * response is always handled gracefully regardless of what the UI shows.
 */
export function canManageEmployees(roles: RoleCode[]): boolean {
  return roles.includes('HR');
}

export function canManageOrgStructure(roles: RoleCode[]): boolean {
  return roles.includes('HR') || roles.includes('ADMIN');
}

export function canUploadDocuments(roles: RoleCode[]): boolean {
  return roles.includes('HR');
}

export function canDeleteDocuments(roles: RoleCode[]): boolean {
  return roles.includes('HR');
}
