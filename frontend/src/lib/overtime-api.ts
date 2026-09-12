import { apiClient } from './api-client';
import type { PaginatedResult } from '@/types/org';
import type { CreateOvertimeInput, OvertimeQuery, OvertimeRecord } from '@/types/time';

export const overtimeApi = {
  list: (query: OvertimeQuery) =>
    apiClient.get<PaginatedResult<OvertimeRecord>>('/overtime', { params: query }).then((r) => r.data),

  get: (id: string) => apiClient.get<OvertimeRecord>(`/overtime/${id}`).then((r) => r.data),

  create: (payload: CreateOvertimeInput) =>
    apiClient.post<OvertimeRecord>('/overtime', payload).then((r) => r.data),

  approve: (id: string) => apiClient.patch<OvertimeRecord>(`/overtime/${id}/approve`).then((r) => r.data),

  reject: (id: string) => apiClient.patch<OvertimeRecord>(`/overtime/${id}/reject`).then((r) => r.data),
};
