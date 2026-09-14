import { apiClient } from './api-client';
import type {
  MfaSetupResponse,
  MfaVerifyResponse,
  NotificationPreferenceEntry,
  SettingsProfile,
  SettingsSession,
} from '@/types/settings';

export const settingsApi = {
  get: () => apiClient.get<SettingsProfile>('/settings').then((r) => r.data),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/settings/password', payload).then((r) => r.data),

  listSessions: () => apiClient.get<SettingsSession[]>('/settings/sessions').then((r) => r.data),

  revokeSession: (sessionId: string) =>
    apiClient.post(`/settings/sessions/${sessionId}/revoke`).then((r) => r.data),

  revokeAllOtherSessions: (currentRefreshToken?: string) =>
    apiClient.post('/settings/sessions/revoke-all', { currentRefreshToken }).then((r) => r.data),

  updateNotificationPreferences: (preferences: NotificationPreferenceEntry[]) =>
    apiClient.put('/settings/notifications', { preferences }).then((r) => r.data),

  setupMfa: () => apiClient.post<MfaSetupResponse>('/settings/mfa/setup').then((r) => r.data),

  verifyMfaSetup: (code: string) =>
    apiClient.post<MfaVerifyResponse>('/settings/mfa/verify', { code }).then((r) => r.data),

  disableMfa: (password: string) =>
    apiClient.post('/settings/mfa/disable', { password }).then((r) => r.data),

  regenerateBackupCodes: (password: string) =>
    apiClient
      .post<MfaVerifyResponse>('/settings/mfa/backup-codes/regenerate', { password })
      .then((r) => r.data),
};
