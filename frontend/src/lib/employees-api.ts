import { apiClient } from './api-client';
import type {
  CreateEmployeeInput,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeQuery,
  PaginatedResult,
  UpdateEmployeeInput,
} from '@/types/org';

export const employeesApi = {
  list: (query: EmployeeQuery) =>
    apiClient
      .get<PaginatedResult<EmployeeListItem>>('/employees', { params: query })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<EmployeeDetail>(`/employees/${id}`).then((r) => r.data),

  create: (payload: CreateEmployeeInput) =>
    apiClient.post<EmployeeDetail>('/employees', payload).then((r) => r.data),

  update: (id: string, payload: UpdateEmployeeInput) =>
    apiClient.patch<EmployeeDetail>(`/employees/${id}`, payload).then((r) => r.data),
};
