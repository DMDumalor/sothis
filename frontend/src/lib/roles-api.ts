import { apiClient } from './api-client';
import type { PermissionCatalogEntry, RoleWithPermissions, UpdateRolePermissionInput } from '@/types/roles';

export const rolesApi = {
  list: () => apiClient.get<RoleWithPermissions[]>('/roles').then((r) => r.data),

  permissionCatalog: () =>
    apiClient.get<PermissionCatalogEntry[]>('/roles/permission-catalog').then((r) => r.data),

  updatePermission: (roleId: string, permissionCode: string, payload: UpdateRolePermissionInput) =>
    apiClient
      .patch<RoleWithPermissions>(`/roles/${roleId}/permissions/${permissionCode}`, payload)
      .then((r) => r.data),

  resetToDefault: (roleId: string) =>
    apiClient.post<RoleWithPermissions>(`/roles/${roleId}/reset`).then((r) => r.data),
};
