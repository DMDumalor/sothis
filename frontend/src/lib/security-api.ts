import { apiClient } from './api-client';
import type { AuditLogPage, SecurityEventPage, SecuritySummary } from '@/types/security';

export const securityApi = {
  summary: () => apiClient.get<SecuritySummary>('/security/summary').then((r) => r.data),

  listAuditLogs: (params: { action?: string; resourceType?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
    apiClient.get<AuditLogPage>('/security/audit-logs', { params }).then((r) => r.data),

  listSecurityEvents: (params: { type?: string; severity?: string; resolved?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<SecurityEventPage>('/security/events', { params }).then((r) => r.data),

  resolveEvent: (id: string, resolveNote?: string) =>
    apiClient.patch(`/security/events/${id}/resolve`, { resolveNote }).then((r) => r.data),
};
