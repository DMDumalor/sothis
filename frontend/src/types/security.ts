import type { PaginatedResult } from './org';

export type SecurityEventType =
  | 'REPEATED_FAILED_LOGIN'
  | 'ACCOUNT_LOCKOUT'
  | 'SUSPICIOUS_LOGIN'
  | 'REPEATED_ACCESS_DENIED'
  | 'UNUSUAL_ADMIN_ACTIVITY'
  | 'SUSPICIOUS_ROLE_CHANGE'
  | 'UNUSUAL_ACCESS_PATTERN'
  | 'CROSS_TENANT_ACCESS_ATTEMPT'
  | 'REFRESH_TOKEN_REUSE';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
}

export interface SecurityEventEntry {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  resolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
}

export interface SecuritySummary {
  unresolvedCount: number;
  criticalUnresolvedCount: number;
  eventsLast24h: number;
  auditActionsLast24h: number;
  unresolvedBySeverity: Record<string, number>;
}

export type AuditLogPage = PaginatedResult<AuditLogEntry>;
export interface SecurityEventPage {
  items: SecurityEventEntry[];
  unresolvedCount: number;
  pagination: PaginatedResult<unknown>['pagination'];
}
