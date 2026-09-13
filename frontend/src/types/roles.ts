import type { RoleCode } from './auth';

export type PermissionScope = 'OWN' | 'DEPARTMENT' | 'TENANT';

export interface PermissionCatalogEntry {
  code: string;
  module: string;
  description: string;
}

export interface RoleWithPermissions {
  id: string;
  code: RoleCode;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Array<{
    code: string;
    module: string;
    description: string;
    scope: PermissionScope;
  }>;
}

export interface UpdateRolePermissionInput {
  granted: boolean;
  scope?: PermissionScope;
}
