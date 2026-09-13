import type { RoleCode } from './auth';

export type UserStatus = 'INVITED' | 'ACTIVE' | 'DISABLED' | 'LOCKED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface UserRoleSummary {
  id: string;
  code: RoleCode;
  name: string;
}

export interface UserListItem {
  id: string;
  email: string;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: { id: string; name: string } | null;
    position: { id: string; title: string } | null;
  } | null;
  userRoles: { role: UserRoleSummary }[];
}

export interface UserQuery {
  search?: string;
  status?: UserStatus;
  role?: RoleCode;
  page?: number;
  pageSize?: number;
}

export interface EmployeeWithoutAccount {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
}

export interface AccountInvitation {
  id: string;
  email: string;
  status: InvitationStatus;
  intendedRoleCode: RoleCode | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  invitedBy: { id: string; email: string };
}

export interface InviteUserInput {
  employeeId: string;
  roleCode: RoleCode;
  email?: string;
}

export interface BulkInviteEntry {
  employeeId: string;
  roleCode: RoleCode;
  email?: string;
}

export interface BulkInviteRowResult {
  employeeId: string;
  success: boolean;
  email?: string;
  error?: string;
}

export interface BulkInviteResult {
  results: BulkInviteRowResult[];
  successCount: number;
  failureCount: number;
}

export interface UserSession {
  id: string;
  family: string;
  createdByIp: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export type LoginAuditResult =
  | 'SUCCESS'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_NOT_ACTIVATED'
  | 'TENANT_NOT_FOUND'
  | 'REFRESH';

export interface UserActivityLoginEntry {
  kind: 'login';
  id: string;
  result: LoginAuditResult;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface UserActivityAuditEntry {
  kind: 'audit';
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
}

export type UserActivityEntry = UserActivityLoginEntry | UserActivityAuditEntry;
