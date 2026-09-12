import { apiClient } from './api-client';
import type { PaginatedResult } from '@/types/org';
import type {
  CreateLeaveRequestInput,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestQuery,
  LeaveType,
} from '@/types/time';

export const leaveApi = {
  listTypes: () => apiClient.get<LeaveType[]>('/leave/types').then((r) => r.data),

  listBalances: (employeeId?: string) =>
    apiClient
      .get<LeaveBalance[]>('/leave/balances', { params: employeeId ? { employeeId } : undefined })
      .then((r) => r.data),

  list: (query: LeaveRequestQuery) =>
    apiClient.get<PaginatedResult<LeaveRequest>>('/leave/requests', { params: query }).then((r) => r.data),

  get: (id: string) => apiClient.get<LeaveRequest>(`/leave/requests/${id}`).then((r) => r.data),

  create: (payload: CreateLeaveRequestInput) =>
    apiClient.post<LeaveRequest>('/leave/requests', payload).then((r) => r.data),

  approve: (id: string, reviewComment?: string) =>
    apiClient.patch<LeaveRequest>(`/leave/requests/${id}/approve`, { reviewComment }).then((r) => r.data),

  reject: (id: string, reviewComment?: string) =>
    apiClient.patch<LeaveRequest>(`/leave/requests/${id}/reject`, { reviewComment }).then((r) => r.data),

  cancel: (id: string) => apiClient.patch<LeaveRequest>(`/leave/requests/${id}/cancel`).then((r) => r.data),
};
