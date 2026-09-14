export type RoleCode =
  | 'ADMIN'
  | 'HR'
  | 'DEPARTMENT_HEAD'
  | 'FINANCE'
  | 'DG'
  | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  email: string;
  roles: RoleCode[];
  organizationCode: string;
  organizationName: string;
}

export interface LoginPayload {
  organizationCode: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

/** Returned by POST /auth/login instead of LoginResponse when the account
 * has MFA enabled — the password was correct, but the caller must still
 * complete POST /auth/mfa/challenge with mfaToken + a TOTP/backup code
 * before receiving real tokens. */
export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

export interface MfaChallengePayload {
  mfaToken: string;
  code: string;
}

export interface MeResponse {
  id: string;
  email: string;
  roles: RoleCode[];
  tenant?: { code: string; name: string };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string | null;
  } | null;
}
