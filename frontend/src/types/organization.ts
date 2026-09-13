import type { RoleCode } from './auth';

export interface OrganizationSecurityPolicy {
  passwordMinLength: number;
  lockoutMaxAttempts: number;
  lockoutDurationMinutes: number;
  refreshTokenTtlDays: number;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  timezone: string;
  logoUrl: string | null;
  createdAt: string;
  security: OrganizationSecurityPolicy;
  stats: {
    employeeCount: number;
    activeUserCount: number;
    departmentCount: number;
    pendingInvitationCount: number;
    roleBreakdown: Array<{ code: RoleCode; name: string; userCount: number }>;
  };
}

export interface UpdateOrganizationInput {
  name?: string;
  timezone?: string;
  logoUrl?: string;
  passwordMinLength?: number;
  lockoutMaxAttempts?: number;
  lockoutDurationMinutes?: number;
  refreshTokenTtlDays?: number;
}
