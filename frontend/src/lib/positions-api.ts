import { apiClient } from './api-client';
import type { Position } from '@/types/org';

export interface PositionInput {
  title: string;
  code: string;
  departmentId?: string;
  level?: number;
  description?: string;
}

export const positionsApi = {
  list: (departmentId?: string) =>
    apiClient
      .get<Position[]>('/positions', { params: departmentId ? { departmentId } : undefined })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<Position>(`/positions/${id}`).then((r) => r.data),

  create: (payload: PositionInput) =>
    apiClient.post<Position>('/positions', payload).then((r) => r.data),

  update: (id: string, payload: Partial<PositionInput>) =>
    apiClient.patch<Position>(`/positions/${id}`, payload).then((r) => r.data),
};
