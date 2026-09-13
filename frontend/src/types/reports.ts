export interface WorkforceReport {
  totalHeadcount: number;
  byEmploymentStatus: Record<string, number>;
  byEmploymentType: Record<string, number>;
  byDepartment: Array<{ departmentId: string | null; departmentName: string; headcount: number }>;
}

export interface LeaveReport {
  byStatus: Record<string, number>;
  approvedRequests: number;
  totalApprovedDays: number | null;
  byLeaveType: Array<{ leaveTypeId: string; leaveTypeName: string; requests: number; totalDays: number | null }>;
}

export interface AttendanceReport {
  byStatus: Record<string, number>;
  totalRecords: number;
  punctualityRate: number | null;
  averageWorkedMinutes: number | null;
  approvedOvertimeHours: number | null;
  approvedOvertimeCount: number;
}

export interface PayrollReportPeriod {
  periodId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  headcount: number;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
}

export interface PayrollReport {
  trend: PayrollReportPeriod[];
  overall: { totalGross: number; totalNet: number; totalDeductions: number; headcount: number };
}

export interface ReportDateRange {
  from?: string;
  to?: string;
}
