import { apiClient } from './api-client';
import type { PaginatedResult } from '@/types/org';
import type { AttendanceQuery, AttendanceRecord, CorrectAttendanceInput } from '@/types/time';

export const attendanceApi = {
  list: (query: AttendanceQuery) =>
    apiClient.get<PaginatedResult<AttendanceRecord>>('/attendance/records', { params: query }).then((r) => r.data),

  get: (id: string) => apiClient.get<AttendanceRecord>(`/attendance/records/${id}`).then((r) => r.data),

  clockIn: (notes?: string) =>
    apiClient.post<AttendanceRecord>('/attendance/clock-in', { notes }).then((r) => r.data),

  clockOut: (notes?: string) =>
    apiClient.post<AttendanceRecord>('/attendance/clock-out', { notes }).then((r) => r.data),

  correct: (id: string, payload: CorrectAttendanceInput) =>
    apiClient.patch<AttendanceRecord>(`/attendance/records/${id}`, payload).then((r) => r.data),
};
