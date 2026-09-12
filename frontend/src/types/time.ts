import type { PaginatedResult } from './org';

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';
export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  departmentId: string | null;
}

export interface LeaveType {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  defaultAnnualDays: number;
  requiresApproval: boolean;
  paid: boolean;
  createdAt: string;
}

/** Decimal fields (allocatedDays, usedDays, pendingDays, carriedOverDays) are
 * serialized by Prisma as numeric strings — convert with Number() to use. */
export interface LeaveBalance {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: string;
  usedDays: string;
  pendingDays: string;
  carriedOverDays: string;
  updatedAt: string;
  leaveType: { id: string; name: string; code: string; paid: boolean };
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  leaveType: LeaveType;
  employee: EmployeeRef;
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface LeaveRequestQuery {
  status?: LeaveRequestStatus;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  workedMinutes: number | null;
  notes: string | null;
  source: 'MANUAL' | 'SYSTEM';
  createdAt: string;
  updatedAt: string;
  employee: EmployeeRef;
}

export interface AttendanceQuery {
  status?: AttendanceStatus;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CorrectAttendanceInput {
  clockIn?: string;
  clockOut?: string;
  status?: AttendanceStatus;
  notes?: string;
}

export interface OvertimeRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  attendanceRecordId: string | null;
  date: string;
  hours: string;
  reason: string | null;
  status: OvertimeStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee: EmployeeRef;
}

export interface CreateOvertimeInput {
  date: string;
  hours: number;
  reason?: string;
  attendanceRecordId?: string;
}

export interface OvertimeQuery {
  status?: OvertimeStatus;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export type { PaginatedResult };
