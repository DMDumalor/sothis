import type { PaginatedResult } from './org';
import type { EmployeeRef } from './time';

export type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'MOBILE_MONEY';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type PayrollItemType = 'BASE_SALARY' | 'OVERTIME';

export interface SalaryStructure {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/** Decimal fields (baseSalary) are Prisma Decimals serialized as numeric strings. */
export interface CompensationRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  salaryStructureId: string | null;
  baseSalary: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdById: string;
  createdAt: string;
  salaryStructure: { id: string; name: string } | null;
}

export interface PayrollPeriod {
  id: string;
  tenantId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count: { payrolls: number };
}

export interface PayrollListItem {
  id: string;
  employeeId: string;
  baseSalary: string;
  overtimePay: string;
  totalAllowances: string;
  totalDeductions: string;
  grossPay: string;
  netPay: string;
  status: PayrollStatus;
  calculatedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  employee: EmployeeRef & { employeeCode: string };
}

export interface PayrollPeriodDetail extends PayrollPeriod {
  payrolls: PayrollListItem[];
}

export interface PayrollLineItem {
  id: string;
  label: string;
  amount: string;
  type?: PayrollItemType;
  overtimeRecordId?: string | null;
}

export interface Payment {
  id: string;
  tenantId: string;
  payrollId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  payroll?: {
    payrollPeriod: { id: string; name: string };
    employee: EmployeeRef & { employeeCode: string };
  };
}

export interface PayrollDetail extends PayrollListItem {
  tenantId: string;
  payrollPeriodId: string;
  payrollPeriod: PayrollPeriod;
  items: PayrollLineItem[];
  allowances: PayrollLineItem[];
  deductions: PayrollLineItem[];
  payslip: { id: string; issuedAt: string } | null;
  payments: Payment[];
}

export interface Payslip {
  id: string;
  tenantId: string;
  payrollId: string;
  employeeId: string;
  issuedAt: string;
  lastViewedAt: string | null;
  payroll: {
    id: string;
    baseSalary: string;
    overtimePay: string;
    totalAllowances: string;
    totalDeductions: string;
    grossPay: string;
    netPay: string;
    status: PayrollStatus;
    payrollPeriod: PayrollPeriod;
    employee: EmployeeRef & { employeeCode: string };
    items?: PayrollLineItem[];
    allowances?: PayrollLineItem[];
    deductions?: PayrollLineItem[];
  };
}

export interface CreatePayrollPeriodInput {
  name?: string;
  periodStart: string;
  periodEnd: string;
}

export interface CreateCompensationInput {
  employeeId: string;
  baseSalary: number;
  currency?: string;
  effectiveFrom: string;
  salaryStructureId?: string;
}

export interface MarkPaidInput {
  method: PaymentMethod;
  reference?: string;
}

export type { PaginatedResult };
