import type { DocumentType, EmploymentStatus, EmploymentType, Gender } from '@/types/org';
import type { AttendanceStatus, LeaveRequestStatus, OvertimeStatus } from '@/types/time';

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
