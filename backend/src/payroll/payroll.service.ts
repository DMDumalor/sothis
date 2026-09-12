import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OvertimeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';

/**
 * Payroll calculation business rules (explainable, not a black box — spec's
 * intelligence-engine ethos applies to the numbers feeding it too):
 *  - Standard monthly hours = 173 (40h/week * 52/12), used to derive an
 *    hourly rate from the monthly base salary.
 *  - Overtime pay = sum of APPROVED OvertimeRecord hours dated within the
 *    period, at 1.5x the derived hourly rate.
 *  - Allowances = a flat 15% of base salary ("Housing & Transport
 *    Allowance") — the same ratio the demo seed data uses, so a freshly
 *    processed period is comparable to the seeded one.
 *  - Deductions = 18% of gross pay, split 70% Income Tax / 30% Pension
 *    (SSNIT) — again matching the seed data's ratio.
 * These are placeholder statutory rules for a demo system, not a real tax
 * table; a production deployment would make them tenant-configurable.
 */
const STANDARD_MONTHLY_HOURS = 173;
const OVERTIME_MULTIPLIER = 1.5;
const ALLOWANCE_RATE = 0.15;
const DEDUCTION_RATE = 0.18;
const INCOME_TAX_SHARE = 0.7;
const PENSION_SHARE = 0.3;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async listPeriods(tenantId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      include: { _count: { select: { payrolls: true } } },
      orderBy: { periodStart: 'desc' },
    });
  }

  async createPeriod(params: { tenantId: string; dto: CreatePayrollPeriodDto; actorUserId: string }) {
    const { tenantId, dto, actorUserId } = params;
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Invalid period dates.');
    }
    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd must be on or after periodStart.');
    }

    const name = dto.name ?? periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { tenantId_periodStart_periodEnd: { tenantId, periodStart, periodEnd } },
    });
    if (existing) {
      throw new ConflictException('A payroll period with these exact dates already exists.');
    }

    const period = await this.prisma.payrollPeriod.create({
      data: { tenantId, name, periodStart, periodEnd, createdById: actorUserId },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'payroll_period.created',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      metadata: { name, periodStart: dto.periodStart, periodEnd: dto.periodEnd },
    });

    return period;
  }

  async getPeriod(tenantId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        payrolls: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
          orderBy: { employee: { lastName: 'asc' } },
        },
      },
    });
    if (!period) throw new NotFoundException('Payroll period not found');
    return period;
  }

  private async findActiveCompensationAsOf(tenantId: string, employeeId: string, asOf: Date) {
    return this.prisma.employeeCompensation.findFirst({
      where: {
        tenantId,
        employeeId,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Calculates payroll for every active employee with a compensation
   * record covering the period. Idempotent per employee (unique on
   * payrollPeriodId+employeeId) and only runs against a DRAFT period, so
   * it can never silently overwrite figures that have already moved past
   * calculation into review/approval.
   */
  async processPeriod(params: { tenantId: string; periodId: string; actorUserId: string }) {
    const { tenantId, periodId, actorUserId } = params;

    const period = await this.prisma.payrollPeriod.findFirst({ where: { id: periodId, tenantId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.status !== 'DRAFT') {
      throw new ConflictException('Only a DRAFT payroll period can be processed.');
    }

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
      select: { id: true },
    });

    const hourlyRateDivisor = STANDARD_MONTHLY_HOURS;
    let processedCount = 0;
    let skippedCount = 0;

    for (const { id: employeeId } of employees) {
      const compensation = await this.findActiveCompensationAsOf(tenantId, employeeId, period.periodEnd);
      if (!compensation) {
        skippedCount += 1;
        continue;
      }

      const baseSalary = Number(compensation.baseSalary);
      const hourlyRate = baseSalary / hourlyRateDivisor;

      const overtimeRecords = await this.prisma.overtimeRecord.findMany({
        where: {
          tenantId,
          employeeId,
          status: OvertimeStatus.APPROVED,
          date: { gte: period.periodStart, lte: period.periodEnd },
        },
      });
      const overtimeHours = overtimeRecords.reduce((sum, r) => sum + Number(r.hours), 0);
      const overtimePay = round2(overtimeHours * hourlyRate * OVERTIME_MULTIPLIER);

      const totalAllowances = round2(baseSalary * ALLOWANCE_RATE);
      const grossPay = round2(baseSalary + overtimePay + totalAllowances);
      const totalDeductions = round2(grossPay * DEDUCTION_RATE);
      const netPay = round2(grossPay - totalDeductions);
      const incomeTax = round2(totalDeductions * INCOME_TAX_SHARE);
      const pension = round2(totalDeductions - incomeTax);

      await this.prisma.$transaction(async (tx) => {
        const payroll = await tx.payroll.upsert({
          where: { payrollPeriodId_employeeId: { payrollPeriodId: period.id, employeeId } },
          update: {
            baseSalary,
            overtimePay,
            totalAllowances,
            totalDeductions,
            grossPay,
            netPay,
            status: 'CALCULATED',
            calculatedAt: new Date(),
          },
          create: {
            tenantId,
            payrollPeriodId: period.id,
            employeeId,
            baseSalary,
            overtimePay,
            totalAllowances,
            totalDeductions,
            grossPay,
            netPay,
            status: 'CALCULATED',
            calculatedAt: new Date(),
          },
        });

        // Replace any prior line items for this payroll (only relevant on a
        // re-run against the same still-DRAFT period, e.g. after a
        // compensation correction).
        await tx.payrollItem.deleteMany({ where: { payrollId: payroll.id } });
        await tx.payrollAllowance.deleteMany({ where: { payrollId: payroll.id } });
        await tx.payrollDeduction.deleteMany({ where: { payrollId: payroll.id } });

        await tx.payrollItem.create({
          data: { payrollId: payroll.id, type: 'BASE_SALARY', label: 'Base Salary', amount: baseSalary },
        });
        for (const record of overtimeRecords) {
          const pay = round2(Number(record.hours) * hourlyRate * OVERTIME_MULTIPLIER);
          await tx.payrollItem.create({
            data: {
              payrollId: payroll.id,
              type: 'OVERTIME',
              label: `Overtime — ${new Date(record.date).toLocaleDateString()}`,
              amount: pay,
              overtimeRecordId: record.id,
            },
          });
        }
        if (totalAllowances > 0) {
          await tx.payrollAllowance.create({
            data: { payrollId: payroll.id, label: 'Housing & Transport Allowance', amount: totalAllowances },
          });
        }
        if (incomeTax > 0) {
          await tx.payrollDeduction.create({
            data: { payrollId: payroll.id, label: 'Income Tax', amount: incomeTax },
          });
        }
        if (pension > 0) {
          await tx.payrollDeduction.create({
            data: { payrollId: payroll.id, label: 'Pension (SSNIT)', amount: pension },
          });
        }
      });

      processedCount += 1;
    }

    const updatedPeriod = await this.prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { status: 'CALCULATED' },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'payroll.calculated',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      metadata: { processedCount, skippedCount },
    });

    return { period: updatedPeriod, processedCount, skippedCount };
  }

  private async findPayrollOrThrow(tenantId: string, id: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, userId: true } },
        payrollPeriod: true,
        items: true,
        allowances: true,
        deductions: true,
        payslip: true,
        payments: true,
      },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found');
    return payroll;
  }

  async getPayroll(tenantId: string, id: string) {
    return this.findPayrollOrThrow(tenantId, id);
  }

  async review(params: { tenantId: string; id: string; actorUserId: string }) {
    const { tenantId, id, actorUserId } = params;
    const payroll = await this.findPayrollOrThrow(tenantId, id);
    if (payroll.status !== 'CALCULATED') {
      throw new ConflictException('Only a CALCULATED payroll record can move to review.');
    }

    const updated = await this.prisma.payroll.update({
      where: { id: payroll.id },
      data: { status: 'UNDER_REVIEW', reviewedById: actorUserId, reviewedAt: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'payroll.reviewed',
      resourceType: 'Payroll',
      resourceId: payroll.id,
      metadata: { employeeId: payroll.employeeId },
    });

    return updated;
  }

  async approve(params: { tenantId: string; id: string; actorUserId: string }) {
    const { tenantId, id, actorUserId } = params;
    const payroll = await this.findPayrollOrThrow(tenantId, id);
    if (payroll.status !== 'UNDER_REVIEW') {
      throw new ConflictException('Only a payroll record UNDER_REVIEW can be approved.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payroll.update({
        where: { id: payroll.id },
        data: { status: 'APPROVED', approvedById: actorUserId, approvedAt: new Date() },
      });
      await tx.payslip.upsert({
        where: { payrollId: payroll.id },
        update: {},
        create: { tenantId, payrollId: payroll.id, employeeId: payroll.employeeId },
      });
      return result;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'payroll.approved',
      resourceType: 'Payroll',
      resourceId: payroll.id,
      metadata: { employeeId: payroll.employeeId, netPay: Number(payroll.netPay) },
    });

    if (payroll.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: payroll.employee.userId,
        category: 'PAYROLL',
        title: 'Payslip available',
        message: `Your payslip for ${payroll.payrollPeriod.name} is ready.`,
        link: '/payslips',
      });
    }

    return updated;
  }

  async markPaid(params: { tenantId: string; id: string; dto: MarkPaidDto; actorUserId: string }) {
    const { tenantId, id, dto, actorUserId } = params;
    const payroll = await this.findPayrollOrThrow(tenantId, id);
    if (payroll.status !== 'APPROVED') {
      throw new ConflictException('Only an APPROVED payroll record can be marked as paid.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payroll.update({
        where: { id: payroll.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await tx.payment.create({
        data: {
          tenantId,
          payrollId: payroll.id,
          amount: payroll.netPay,
          method: dto.method,
          reference: dto.reference,
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });
      return result;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'payroll.paid',
      resourceType: 'Payroll',
      resourceId: payroll.id,
      metadata: { employeeId: payroll.employeeId, amount: Number(payroll.netPay), method: dto.method },
    });

    if (payroll.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: payroll.employee.userId,
        category: 'PAYROLL',
        title: 'Salary paid',
        message: `Your salary for ${payroll.payrollPeriod.name} has been paid.`,
        link: '/payslips',
      });
    }

    return updated;
  }

  // ---- Payslips -----------------------------------------------------

  async listPayslips(tenantId: string, query: { employeeId?: string; page: number; pageSize: number }, onlyEmployeeId?: string) {
    const where: Prisma.PayslipWhereInput = { tenantId };
    if (onlyEmployeeId) {
      where.employeeId = onlyEmployeeId;
    } else if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payslip.count({ where }),
      this.prisma.payslip.findMany({
        where,
        include: {
          payroll: {
            include: {
              payrollPeriod: true,
              employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  // ---- Payments -------------------------------------------------------

  async listPayments(tenantId: string, query: { page: number; pageSize: number }) {
    const where: Prisma.PaymentWhereInput = { tenantId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          payroll: {
            include: {
              payrollPeriod: { select: { id: true, name: true } },
              employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getPayslip(tenantId: string, id: string, onlyEmployeeId?: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, tenantId },
      include: {
        payroll: {
          include: {
            payrollPeriod: true,
            items: true,
            allowances: true,
            deductions: true,
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (onlyEmployeeId && payslip.employeeId !== onlyEmployeeId) {
      throw new NotFoundException('Payslip not found');
    }
    return payslip;
  }
}
