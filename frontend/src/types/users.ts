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
