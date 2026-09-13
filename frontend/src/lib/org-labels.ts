import type { DocumentType, EmploymentStatus, EmploymentType, Gender } from '@/types/org';
import type { AttendanceStatus, LeaveRequestStatus, OvertimeStatus } from '@/types/time';
import type { PaymentMethod, PaymentStatus, PayrollStatus } from '@/types/payroll';
import type { InsightStatus, RiskLevel } from '@/types/intelligence';
import type { SecuritySeverity } from '@/types/security';
import type { InvitationStatus, UserStatus } from '@/types/users';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
};

export const EMPLOYMENT_STATUS_TONE: Record<EmploymentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'error',
  TERMINATED: 'neutral',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  UNSPECIFIED: 'Unspecified',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  IDENTITY: 'Identity document',
  EMPLOYMENT_CONTRACT: 'Employment contract',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const LEAVE_STATUS_TONE: Record<LeaveRequestStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  ON_LEAVE: 'On leave',
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'error',
  HALF_DAY: 'info',
  ON_LEAVE: 'neutral',
};

export const OVERTIME_STATUS_LABELS: Record<OvertimeStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

export const OVERTIME_STATUS_TONE: Record<OvertimeStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  PAID: 'info',
};

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculated',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const PAYROLL_STATUS_TONE: Record<PayrollStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  CALCULATED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PAID: 'success',
  CANCELLED: 'error',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  MOBILE_MONEY: 'Mobile money',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const RISK_LEVEL_TONE: Record<RiskLevel, 'success' | 'warning' | 'error' | 'neutral'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

export const INSIGHT_STATUS_LABELS: Record<InsightStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  REVIEWED: 'Reviewed',
  DISMISSED: 'Dismissed',
};

export const INSIGHT_STATUS_TONE: Record<InsightStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  OPEN: 'warning',
  UNDER_REVIEW: 'info',
  REVIEWED: 'success',
  DISMISSED: 'neutral',
};

export const SECURITY_SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const SECURITY_SEVERITY_TONE: Record<SecuritySeverity, 'success' | 'warning' | 'error' | 'neutral'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  INVITED: 'Invited',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  LOCKED: 'Locked',
};

export const USER_STATUS_TONE: Record<UserStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  INVITED: 'info',
  ACTIVE: 'success',
  DISABLED: 'neutral',
  LOCKED: 'error',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
};

export const INVITATION_STATUS_TONE: Record<InvitationStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
  EXPIRED: 'error',
};
