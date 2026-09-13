import { apiClient } from './api-client';
import type { AttendanceReport, LeaveReport, PayrollReport, ReportDateRange, WorkforceReport } from '@/types/reports';

export const reportsApi = {
  workforce: () => apiClient.get<WorkforceReport>('/reports/workforce').then((r) => r.data),

  leave: (params: ReportDateRange = {}) =>
    apiClient.get<LeaveReport>('/reports/leave', { params }).then((r) => r.data),

  attendance: (params: ReportDateRange = {}) =>
    apiClient.get<AttendanceReport>('/reports/attendance', { params }).then((r) => r.data),

  payroll: (params: ReportDateRange = {}) =>
    apiClient.get<PayrollReport>('/reports/payroll', { params }).then((r) => r.data),
};
