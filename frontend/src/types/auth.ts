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
