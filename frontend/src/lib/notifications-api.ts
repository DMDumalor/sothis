import { apiClient } from './api-client';
import type { NotificationsPage } from '@/types/notifications';

export const notificationsApi = {
  list: (params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) =>
    apiClient.get<NotificationsPage>('/notifications', { params }).then((r) => r.data),

  unreadCount: () => apiClient.get<{ unreadCount: number }>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () => apiClient.post('/notifications/read-all').then((r) => r.data),
};
