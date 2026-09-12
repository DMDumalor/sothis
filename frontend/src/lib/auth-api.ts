import { apiClient } from './api-client';
import type { LoginPayload, LoginResponse, MeResponse } from '@/types/auth';

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),

  me: () => apiClient.get<MeResponse>('/auth/me').then((r) => r.data),

  acceptInvitation: (payload: { token: string; password: string }) =>
    apiClient.post('/auth/account-invitations/accept', payload).then((r) => r.data),
};
