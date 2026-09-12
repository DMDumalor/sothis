import { apiClient } from './api-client';
import type { PaginatedResult } from '@/types/org';
import type {
  CreatePayrollPeriodInput,
  MarkPaidInput,
  Payment,
  PayrollDetail,
  PayrollPeriod,
  PayrollPeriodDetail,
  Payslip,
} from '@/types/payroll';

export const payrollApi = {
  listPeriods: () => apiClient.get<PayrollPeriod[]>('/payroll/periods').then((r) => r.data),

  createPeriod: (payload: CreatePayrollPeriodInput) =>
    apiClient.post<PayrollPeriod>('/payroll/periods', payload).then((r) => r.data),

  getPeriod: (id: string) => apiClient.get<PayrollPeriodDetail>(`/payroll/periods/${id}`).then((r) => r.data),

  processPeriod: (id: string) =>
    apiClient.post<{ period: PayrollPeriod; processedCount: number; skippedCount: number }>(
      `/payroll/periods/${id}/process`,
    ).then((r) => r.data),

  getPayroll: (id: string) => apiClient.get<PayrollDetail>(`/payroll/${id}`).then((r) => r.data),

  review: (id: string) => apiClient.patch<PayrollDetail>(`/payroll/${id}/review`).then((r) => r.data),

  approve: (id: string) => apiClient.patch<PayrollDetail>(`/payroll/${id}/approve`).then((r) => r.data),

  markPaid: (id: string, payload: MarkPaidInput) =>
    apiClient.patch<PayrollDetail>(`/payroll/${id}/mark-paid`, payload).then((r) => r.data),

  listPayments: (query: { page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResult<Payment>>('/payments', { params: query }).then((r) => r.data),

  listPayslips: (query: { employeeId?: string; page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResult<Payslip>>('/payslips', { params: query }).then((r) => r.data),

  getPayslip: (id: string) => apiClient.get<Payslip>(`/payslips/${id}`).then((r) => r.data),
};
