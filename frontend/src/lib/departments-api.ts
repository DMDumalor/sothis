import { apiClient } from './api-client';
import type { Department, EmployeeListItem } from '@/types/org';

export interface DepartmentInput {
  name: string;
  code: string;
  description?: string;
  headEmployeeId?: string;
  parentDepartmentId?: string;
}

export const departmentsApi = {
  list: () => apiClient.get<Department[]>('/departments').then((r) => r.data),

  get: (id: string) => apiClient.get<Department>(`/departments/${id}`).then((r) => r.data),

  employees: (id: string) =>
    apiClient.get<EmployeeListItem[]>(`/departments/${id}/employees`).then((r) => r.data),

  create: (payload: DepartmentInput) =>
    apiClient.post<Department>('/departments', payload).then((r) => r.data),

  update: (id: string, payload: Partial<DepartmentInput>) =>
    apiClient.patch<Department>(`/departments/${id}`, payload).then((r) => r.data),
};
