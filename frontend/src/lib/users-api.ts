import { apiClient } from './api-client';
import type { PaginatedResult } from '@/types/org';
import type {
  AccountInvitation,
  BulkInviteEntry,
  BulkInviteResult,
  EmployeeWithoutAccount,
  InviteUserInput,
  UserActivityEntry,
  UserListItem,
  UserQuery,
  UserSession,
  UserStatus,
} from '@/types/users';
import type { RoleCode } from '@/types/auth';

export const usersApi = {
  list: (query: UserQuery) =>
    apiClient
      .get<PaginatedResult<UserListItem>>('/users', { params: query })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<UserListItem>(`/users/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: Extract<UserStatus, 'ACTIVE' | 'DISABLED'>) =>
    apiClient.patch<UserListItem>(`/users/${id}/status`, { status }).then((r) => r.data),

  unlock: (id: string) => apiClient.post<UserListItem>(`/users/${id}/unlock`).then((r) => r.data),

  updateRoles: (id: string, roleCodes: RoleCode[]) =>
    apiClient.patch<UserListItem>(`/users/${id}/roles`, { roleCodes }).then((r) => r.data),

  listEmployeesWithoutAccount: () =>
    apiClient.get<EmployeeWithoutAccount[]>('/users/employees-without-account').then((r) => r.data),

  listInvitations: () =>
    apiClient.get<AccountInvitation[]>('/users/invitations').then((r) => r.data),

  inviteUser: (payload: InviteUserInput) =>
    apiClient.post<{ id: string; email: string; expiresAt: string; intendedRoleCode: RoleCode }>(
      '/users/invitations',
      payload,
    ).then((r) => r.data),

  revokeInvitation: (invitationId: string) =>
    apiClient.post(`/users/invitations/${invitationId}/revoke`).then((r) => r.data),

  resendInvitation: (invitationId: string) =>
    apiClient.post(`/users/invitations/${invitationId}/resend`).then((r) => r.data),

  bulkInvite: (invitations: BulkInviteEntry[]) =>
    apiClient
      .post<BulkInviteResult>('/users/invitations/bulk', { invitations })
      .then((r) => r.data),

  listSessions: (id: string) =>
    apiClient.get<UserSession[]>(`/users/${id}/sessions`).then((r) => r.data),

  revokeSession: (id: string, sessionId: string) =>
    apiClient.post(`/users/${id}/sessions/${sessionId}/revoke`).then((r) => r.data),

  revokeAllSessions: (id: string) =>
    apiClient.post(`/users/${id}/sessions/revoke-all`).then((r) => r.data),

  getActivity: (id: string) =>
    apiClient.get<UserActivityEntry[]>(`/users/${id}/activity`).then((r) => r.data),
};
