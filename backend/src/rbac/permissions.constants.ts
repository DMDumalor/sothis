/**
 * Fine-grained permission catalog (spec section 11). This is the single
 * source of truth for permission codes: the seed script inserts one
 * Permission row per entry here, and controllers reference these constants
 * via the @Permissions() decorator rather than hardcoded strings.
 */
export const PERMISSIONS = {
  // Users / platform admin
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DISABLE: 'user.disable',
  ROLE_MANAGE: 'role.manage',
  PERMISSION_MANAGE: 'permission.manage',
  ORGANIZATION_MANAGE: 'organization.manage',

  // Employees
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_DOCUMENT_READ: 'employee.document.read',
  EMPLOYEE_DOCUMENT_UPLOAD: 'employee.document.upload',
  EMPLOYEE_DOCUMENT_DELETE: 'employee.document.delete',
  EMPLOYEE_INVITE: 'employee.invite',

  // Departments / positions
  DEPARTMENT_READ: 'department.read',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  POSITION_READ: 'position.read',
  POSITION_CREATE: 'position.create',
  POSITION_UPDATE: 'position.update',

  // Leave
  LEAVE_READ: 'leave.read',
  LEAVE_CREATE: 'leave.create',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',

  // Attendance / overtime
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_UPDATE: 'attendance.update',
  OVERTIME_READ: 'overtime.read',
  OVERTIME_CREATE: 'overtime.create',
  OVERTIME_APPROVE: 'overtime.approve',

  // Payroll / finance
  PAYROLL_READ: 'payroll.read',
  PAYROLL_PROCESS: 'payroll.process',
  PAYROLL_REVIEW: 'payroll.review',
  PAYROLL_APPROVE: 'payroll.approve',
  PAYSLIP_READ: 'payslip.read',
  COMPENSATION_MANAGE: 'compensation.manage',

  // Reports
  REPORT_READ: 'report.read',
  REPORT_EXPORT: 'report.export',

  // Security & audit
  SECURITY_READ: 'security.read',
  AUDIT_READ: 'audit.read',

  // Intelligence
  SMART_INSIGHT_READ: 'smart-insight.read',
  SMART_INSIGHT_REVIEW: 'smart-insight.review',

  // Notifications / settings (self-service, granted to every role)
  NOTIFICATION_READ: 'notification.read',
  SETTINGS_READ: 'settings.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: Array<{
  code: PermissionCode;
  module: string;
  description: string;
}> = [
  { code: PERMISSIONS.USER_CREATE, module: 'user', description: 'Create platform user accounts' },
  { code: PERMISSIONS.USER_READ, module: 'user', description: 'View platform user accounts' },
  { code: PERMISSIONS.USER_UPDATE, module: 'user', description: 'Update platform user accounts' },
  { code: PERMISSIONS.USER_DISABLE, module: 'user', description: 'Disable/re-enable user accounts' },
  { code: PERMISSIONS.ROLE_MANAGE, module: 'user', description: 'Manage roles' },
  { code: PERMISSIONS.PERMISSION_MANAGE, module: 'user', description: 'Manage role-permission assignments' },
  { code: PERMISSIONS.ORGANIZATION_MANAGE, module: 'user', description: 'Manage organization/tenant settings' },

  { code: PERMISSIONS.EMPLOYEE_CREATE, module: 'employee', description: 'Create employees' },
  { code: PERMISSIONS.EMPLOYEE_READ, module: 'employee', description: 'View employee records' },
  { code: PERMISSIONS.EMPLOYEE_UPDATE, module: 'employee', description: 'Update employee records' },
  { code: PERMISSIONS.EMPLOYEE_DELETE, module: 'employee', description: 'Delete/deactivate employee records' },
  { code: PERMISSIONS.EMPLOYEE_DOCUMENT_READ, module: 'employee', description: 'View employee documents' },
  { code: PERMISSIONS.EMPLOYEE_DOCUMENT_UPLOAD, module: 'employee', description: 'Upload employee documents' },
  { code: PERMISSIONS.EMPLOYEE_DOCUMENT_DELETE, module: 'employee', description: 'Delete employee documents' },
  { code: PERMISSIONS.EMPLOYEE_INVITE, module: 'employee', description: 'Send account invitations to employees' },

  { code: PERMISSIONS.DEPARTMENT_READ, module: 'department', description: 'View departments' },
  { code: PERMISSIONS.DEPARTMENT_CREATE, module: 'department', description: 'Create departments' },
  { code: PERMISSIONS.DEPARTMENT_UPDATE, module: 'department', description: 'Update departments' },
  { code: PERMISSIONS.POSITION_READ, module: 'department', description: 'View positions' },
  { code: PERMISSIONS.POSITION_CREATE, module: 'department', description: 'Create positions' },
  { code: PERMISSIONS.POSITION_UPDATE, module: 'department', description: 'Update positions' },

  { code: PERMISSIONS.LEAVE_READ, module: 'leave', description: 'View leave requests/balances' },
  { code: PERMISSIONS.LEAVE_CREATE, module: 'leave', description: 'Submit leave requests' },
  { code: PERMISSIONS.LEAVE_APPROVE, module: 'leave', description: 'Approve leave requests' },
  { code: PERMISSIONS.LEAVE_REJECT, module: 'leave', description: 'Reject leave requests' },

  { code: PERMISSIONS.ATTENDANCE_READ, module: 'attendance', description: 'View attendance records' },
  { code: PERMISSIONS.ATTENDANCE_CREATE, module: 'attendance', description: 'Record attendance (clock in/out)' },
  { code: PERMISSIONS.ATTENDANCE_UPDATE, module: 'attendance', description: 'Correct attendance records' },
  { code: PERMISSIONS.OVERTIME_READ, module: 'attendance', description: 'View overtime records' },
  { code: PERMISSIONS.OVERTIME_CREATE, module: 'attendance', description: 'Submit overtime' },
  { code: PERMISSIONS.OVERTIME_APPROVE, module: 'attendance', description: 'Approve overtime' },

  { code: PERMISSIONS.PAYROLL_READ, module: 'payroll', description: 'View payroll data' },
  { code: PERMISSIONS.PAYROLL_PROCESS, module: 'payroll', description: 'Run payroll calculations' },
  { code: PERMISSIONS.PAYROLL_REVIEW, module: 'payroll', description: 'Review calculated payroll' },
  { code: PERMISSIONS.PAYROLL_APPROVE, module: 'payroll', description: 'Approve payroll for payment' },
  { code: PERMISSIONS.PAYSLIP_READ, module: 'payroll', description: 'View payslips' },
  { code: PERMISSIONS.COMPENSATION_MANAGE, module: 'payroll', description: 'Manage salary structures/compensation' },

  { code: PERMISSIONS.REPORT_READ, module: 'report', description: 'View reports/analytics' },
  { code: PERMISSIONS.REPORT_EXPORT, module: 'report', description: 'Export reports' },

  { code: PERMISSIONS.SECURITY_READ, module: 'security', description: 'View security center' },
  { code: PERMISSIONS.AUDIT_READ, module: 'security', description: 'View audit logs' },

  { code: PERMISSIONS.SMART_INSIGHT_READ, module: 'intelligence', description: 'View smart insights' },
  { code: PERMISSIONS.SMART_INSIGHT_REVIEW, module: 'intelligence', description: 'Review/close smart insights' },

  { code: PERMISSIONS.NOTIFICATION_READ, module: 'notification', description: 'View own notifications' },
  { code: PERMISSIONS.SETTINGS_READ, module: 'settings', description: 'View own settings' },
];
