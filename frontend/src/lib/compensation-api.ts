import { apiClient } from './api-client';
import type { CompensationRecord, CreateCompensationInput, SalaryStructure } from '@/types/payroll';

export const compensationApi = {
  listSalaryStructures: () =>
    apiClient.get<SalaryStructure[]>('/compensation/salary-structures').then((r) => r.data),

  listForEmployee: (employeeId: string) =>
    apiClient.get<CompensationRecord[]>(`/compensation/employees/${employeeId}`).then((r) => r.data),

  create: (payload: CreateCompensationInput) =>
    apiClient.post<CompensationRecord>('/compensation', payload).then((r) => r.data),
};
