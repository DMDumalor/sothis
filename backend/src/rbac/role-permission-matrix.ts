import { PERMISSIONS, PermissionCode } from './permissions.constants';

export type Scope = 'OWN' | 'DEPARTMENT' | 'TENANT';

export interface RolePermissionGrant {
  permission: PermissionCode;
  scope: Scope;
}

const P = PERMISSIONS;

/**
 * Role -> permission -> scope matrix (spec sections 6 and 11, blueprint
 * section 3). This is the seed-time source of truth; changing a role's
 * capabilities means changing this file (and re-seeding or migrating role
 * permissions), never hardcoding a role name check in a controller.
 */
export const ROLE_PERMISSION_MATRIX: Record<
  'ADMIN' | 'HR' | 'DEPARTMENT_HEAD' | 'FINANCE' | 'DG' | 'EMPLOYEE',
  RolePermissionGrant[]
> = {
  ADMIN: [
    { permission: P.USER_CREATE, scope: 'TENANT' },
    { permission: P.USER_READ, scope: 'TENANT' },
    { permission: P.USER_UPDATE, scope: 'TENANT' },
    { permission: P.USER_DISABLE, scope: 'TENANT' },
    { permission: P.ROLE_MANAGE, scope: 'TENANT' },
    { permission: P.PERMISSION_MANAGE, scope: 'TENANT' },
    { permission: P.ORGANIZATION_MANAGE, scope: 'TENANT' },
    { permission: P.EMPLOYEE_READ, scope: 'TENANT' },
    { permission: P.DEPARTMENT_READ, scope: 'TENANT' },
    { permission: P.DEPARTMENT_CREATE, scope: 'TENANT' },
    { permission: P.DEPARTMENT_UPDATE, scope: 'TENANT' },
    { permission: P.POSITION_READ, scope: 'TENANT' },
    { permission: P.POSITION_CREATE, scope: 'TENANT' },
    { permission: P.POSITION_UPDATE, scope: 'TENANT' },
    { permission: P.SECURITY_READ, scope: 'TENANT' },
    { permission: P.AUDIT_READ, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_READ, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_REVIEW, scope: 'TENANT' },
    { permission: P.REPORT_READ, scope: 'TENANT' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
  HR: [
    { permission: P.EMPLOYEE_CREATE, scope: 'TENANT' },
    { permission: P.EMPLOYEE_READ, scope: 'TENANT' },
    { permission: P.EMPLOYEE_UPDATE, scope: 'TENANT' },
    { permission: P.EMPLOYEE_DELETE, scope: 'TENANT' },
    { permission: P.EMPLOYEE_DOCUMENT_READ, scope: 'TENANT' },
    { permission: P.EMPLOYEE_DOCUMENT_UPLOAD, scope: 'TENANT' },
    { permission: P.EMPLOYEE_DOCUMENT_DELETE, scope: 'TENANT' },
    { permission: P.EMPLOYEE_INVITE, scope: 'TENANT' },
    { permission: P.DEPARTMENT_READ, scope: 'TENANT' },
    { permission: P.DEPARTMENT_CREATE, scope: 'TENANT' },
    { permission: P.DEPARTMENT_UPDATE, scope: 'TENANT' },
    { permission: P.POSITION_READ, scope: 'TENANT' },
    { permission: P.POSITION_CREATE, scope: 'TENANT' },
    { permission: P.POSITION_UPDATE, scope: 'TENANT' },
    { permission: P.LEAVE_READ, scope: 'TENANT' },
    { permission: P.LEAVE_APPROVE, scope: 'TENANT' },
    { permission: P.LEAVE_REJECT, scope: 'TENANT' },
    { permission: P.ATTENDANCE_READ, scope: 'TENANT' },
    { permission: P.ATTENDANCE_UPDATE, scope: 'TENANT' },
    { permission: P.OVERTIME_READ, scope: 'TENANT' },
    { permission: P.REPORT_READ, scope: 'TENANT' },
    { permission: P.REPORT_EXPORT, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_READ, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_REVIEW, scope: 'TENANT' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
  DEPARTMENT_HEAD: [
    { permission: P.EMPLOYEE_READ, scope: 'DEPARTMENT' },
    { permission: P.DEPARTMENT_READ, scope: 'DEPARTMENT' },
    { permission: P.LEAVE_READ, scope: 'DEPARTMENT' },
    { permission: P.LEAVE_APPROVE, scope: 'DEPARTMENT' },
    { permission: P.LEAVE_REJECT, scope: 'DEPARTMENT' },
    { permission: P.ATTENDANCE_READ, scope: 'DEPARTMENT' },
    { permission: P.OVERTIME_READ, scope: 'DEPARTMENT' },
    { permission: P.OVERTIME_APPROVE, scope: 'DEPARTMENT' },
    { permission: P.REPORT_READ, scope: 'DEPARTMENT' },
    { permission: P.SMART_INSIGHT_READ, scope: 'DEPARTMENT' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
  FINANCE: [
    { permission: P.EMPLOYEE_READ, scope: 'TENANT' },
    { permission: P.COMPENSATION_MANAGE, scope: 'TENANT' },
    { permission: P.OVERTIME_READ, scope: 'TENANT' },
    { permission: P.PAYROLL_READ, scope: 'TENANT' },
    { permission: P.PAYROLL_PROCESS, scope: 'TENANT' },
    { permission: P.PAYROLL_REVIEW, scope: 'TENANT' },
    { permission: P.PAYROLL_APPROVE, scope: 'TENANT' },
    { permission: P.PAYSLIP_READ, scope: 'TENANT' },
    { permission: P.REPORT_READ, scope: 'TENANT' },
    { permission: P.REPORT_EXPORT, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_READ, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_REVIEW, scope: 'TENANT' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
  DG: [
    { permission: P.EMPLOYEE_READ, scope: 'TENANT' },
    { permission: P.DEPARTMENT_READ, scope: 'TENANT' },
    { permission: P.PAYROLL_READ, scope: 'TENANT' },
    { permission: P.REPORT_READ, scope: 'TENANT' },
    { permission: P.REPORT_EXPORT, scope: 'TENANT' },
    { permission: P.SMART_INSIGHT_READ, scope: 'TENANT' },
    { permission: P.SECURITY_READ, scope: 'TENANT' },
    { permission: P.AUDIT_READ, scope: 'TENANT' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
  EMPLOYEE: [
    { permission: P.EMPLOYEE_READ, scope: 'OWN' },
    { permission: P.EMPLOYEE_DOCUMENT_READ, scope: 'OWN' },
    { permission: P.LEAVE_READ, scope: 'OWN' },
    { permission: P.LEAVE_CREATE, scope: 'OWN' },
    { permission: P.ATTENDANCE_READ, scope: 'OWN' },
    { permission: P.OVERTIME_READ, scope: 'OWN' },
    { permission: P.OVERTIME_CREATE, scope: 'OWN' },
    { permission: P.PAYSLIP_READ, scope: 'OWN' },
    { permission: P.NOTIFICATION_READ, scope: 'OWN' },
    { permission: P.SETTINGS_READ, scope: 'OWN' },
  ],
};
