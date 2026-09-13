import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeOwnedScopeRestriction } from '../rbac/scope.service';
import { QueryReportDto } from './dto/query-report.dto';

/**
 * Reports & analytics read models (spec section 27). REPORT_READ is
 * granted TENANT to ADMIN/HR/FINANCE/DG and DEPARTMENT to
 * DEPARTMENT_HEAD, so every method here accepts the already-resolved
 * `EmployeeOwnedScopeRestriction` (via ScopeService, same pattern as
 * every other module) and narrows to `restriction.departmentId` when
 * present. There is no OWN variant for reports, so `onlyEmployeeId` is
 * never granted by the matrix for this permission, but it is still
 * honored defensively for the same reason ScopeService always returns it
 * for OWN grants.
 *
 * Payroll figures are intentionally kept out of every method here except
 * `payrollSummary`, which the controller gates on PAYROLL_READ (Finance/DG
 * only) rather than REPORT_READ — since @RequirePermissions is OR
 * semantics, a true "REPORT_READ AND PAYROLL_READ" gate isn't expressible
 * with the decorator, so confidentiality is enforced by gating on the
 * narrower, already-restricted PAYROLL_READ permission instead.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(
    from?: string,
    to?: string,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return range;
  }

  async workforceSummary(
    tenantId: string,
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    const where: Prisma.EmployeeWhereInput = { tenantId };
    if (restriction?.onlyEmployeeId) {
      where.id = restriction.onlyEmployeeId;
    } else if (restriction?.departmentId) {
      where.departmentId = restriction.departmentId;
    }

    // Promise.all rather than $transaction: groupBy's return-type
    // inference (specifically the `_count._all` field) is lost when the
    // call is contextually typed as a PrismaPromise array element for
    // $transaction, so plain concurrent promises are used for read-only
    // aggregate stats where an atomic snapshot isn't required.
    const [total, byStatus, byType, byDepartmentRaw] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.groupBy({
        by: ['employmentStatus'],
        where,
        _count: { _all: true },
        orderBy: { employmentStatus: 'asc' },
      }),
      this.prisma.employee.groupBy({
        by: ['employmentType'],
        where,
        _count: { _all: true },
        orderBy: { employmentType: 'asc' },
      }),
      this.prisma.employee.groupBy({
        by: ['departmentId'],
        where,
        _count: { _all: true },
        orderBy: { departmentId: 'asc' },
      }),
    ]);

    const departmentIds = byDepartmentRaw
      .map((r) => r.departmentId)
      .filter(Boolean) as string[];
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
    const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

    return {
      totalHeadcount: total,
      byEmploymentStatus: Object.fromEntries(
        byStatus.map((r) => [r.employmentStatus, r._count._all]),
      ),
      byEmploymentType: Object.fromEntries(
        byType.map((r) => [r.employmentType, r._count._all]),
      ),
      byDepartment: byDepartmentRaw.map((r) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentId
          ? (deptNameById.get(r.departmentId) ?? 'Unknown')
          : 'Unassigned',
        headcount: r._count._all,
      })),
    };
  }

  async leaveSummary(
    tenantId: string,
    query: QueryReportDto,
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    const where: Prisma.LeaveRequestWhereInput = { tenantId };
    const createdAtRange = this.dateRange(query.from, query.to);
    if (createdAtRange) where.createdAt = createdAtRange;

    if (restriction?.onlyEmployeeId) {
      where.employeeId = restriction.onlyEmployeeId;
    } else if (restriction?.departmentId) {
      where.employee = { departmentId: restriction.departmentId };
    }

    const [byStatus, approved, byType] = await Promise.all([
      this.prisma.leaveRequest.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.leaveRequest.aggregate({
        where: { ...where, status: 'APPROVED' },
        _sum: { days: true },
        _count: { _all: true },
      }),
      this.prisma.leaveRequest.groupBy({
        by: ['leaveTypeId'],
        where: { ...where, status: 'APPROVED' },
        _sum: { days: true },
        _count: { _all: true },
        orderBy: { leaveTypeId: 'asc' },
      }),
    ]);

    const leaveTypeIds = byType.map((r) => r.leaveTypeId);
    const leaveTypes = leaveTypeIds.length
      ? await this.prisma.leaveType.findMany({
          where: { id: { in: leaveTypeIds } },
          select: { id: true, name: true },
        })
      : [];
    const leaveTypeNameById = new Map(leaveTypes.map((t) => [t.id, t.name]));

    return {
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      approvedRequests: approved._count._all,
      totalApprovedDays: toNumber(approved._sum.days),
      byLeaveType: byType.map((r) => ({
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: leaveTypeNameById.get(r.leaveTypeId) ?? 'Unknown',
        requests: r._count._all,
        totalDays: toNumber(r._sum.days),
      })),
    };
  }

  async attendanceSummary(
    tenantId: string,
    query: QueryReportDto,
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    const where: Prisma.AttendanceRecordWhereInput = { tenantId };
    const dateRange = this.dateRange(query.from, query.to);
    if (dateRange) where.date = dateRange;

    if (restriction?.onlyEmployeeId) {
      where.employeeId = restriction.onlyEmployeeId;
    } else if (restriction?.departmentId) {
      where.employee = { departmentId: restriction.departmentId };
    }

    const overtimeWhere: Prisma.OvertimeRecordWhereInput = {
      tenantId,
      status: { in: ['APPROVED', 'PAID'] },
    };
    if (dateRange) overtimeWhere.date = dateRange;
    if (restriction?.onlyEmployeeId) {
      overtimeWhere.employeeId = restriction.onlyEmployeeId;
    } else if (restriction?.departmentId) {
      overtimeWhere.employee = { departmentId: restriction.departmentId };
    }

    const [byStatus, avgWorked, overtimeAgg] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.attendanceRecord.aggregate({
        where,
        _avg: { workedMinutes: true },
      }),
      this.prisma.overtimeRecord.aggregate({
        where: overtimeWhere,
        _sum: { hours: true },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all]),
    ) as Record<string, number>;
    const present = counts['PRESENT'] ?? 0;
    const late = counts['LATE'] ?? 0;
    const absent = counts['ABSENT'] ?? 0;
    const halfDay = counts['HALF_DAY'] ?? 0;
    const onLeave = counts['ON_LEAVE'] ?? 0;
    const punctualityRate =
      present + late > 0 ? present / (present + late) : null;

    return {
      byStatus: counts,
      totalRecords: present + late + absent + halfDay + onLeave,
      punctualityRate,
      averageWorkedMinutes: toNumber(avgWorked._avg.workedMinutes),
      approvedOvertimeHours: toNumber(overtimeAgg._sum.hours),
      approvedOvertimeCount: overtimeAgg._count._all,
    };
  }

  /** Gated by PAYROLL_READ at the controller, never REPORT_READ alone — see class doc. */
  async payrollSummary(tenantId: string, query: QueryReportDto) {
    const where: Prisma.PayrollPeriodWhereInput = { tenantId };
    const range = this.dateRange(query.from, query.to);
    if (range) where.periodStart = range;

    const periods = await this.prisma.payrollPeriod.findMany({
      where,
      orderBy: { periodStart: 'asc' },
      include: {
        payrolls: {
          select: {
            grossPay: true,
            netPay: true,
            totalDeductions: true,
            status: true,
          },
        },
      },
    });

    const trend = periods.map((period) => {
      const rows = period.payrolls;
      const totalGross = rows.reduce(
        (sum, p) => sum + (toNumber(p.grossPay) ?? 0),
        0,
      );
      const totalNet = rows.reduce(
        (sum, p) => sum + (toNumber(p.netPay) ?? 0),
        0,
      );
      const totalDeductions = rows.reduce(
        (sum, p) => sum + (toNumber(p.totalDeductions) ?? 0),
        0,
      );
      return {
        periodId: period.id,
        periodName: period.name,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        status: period.status,
        headcount: rows.length,
        totalGross,
        totalNet,
        totalDeductions,
      };
    });

    const overall = trend.reduce(
      (acc, t) => ({
        totalGross: acc.totalGross + t.totalGross,
        totalNet: acc.totalNet + t.totalNet,
        totalDeductions: acc.totalDeductions + t.totalDeductions,
        headcount: acc.headcount + t.headcount,
      }),
      { totalGross: 0, totalNet: 0, totalDeductions: 0, headcount: 0 },
    );

    return { trend, overall };
  }
}

function toNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}
