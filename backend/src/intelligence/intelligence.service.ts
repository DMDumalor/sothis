import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InsightCategory, Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeOwnedScopeRestriction } from '../rbac/scope.service';
import { QueryInsightsDto } from './dto/query-insights.dto';
import { ReviewTargetStatus } from './dto/review-insight.dto';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function riskLevelForScore(score: number): RiskLevel {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

interface RaiseInsightParams {
  tenantId: string;
  category: InsightCategory;
  title: string;
  riskScore: number;
  reasons: string[];
  affectedArea: string;
  recommendedAction: string;
  ruleCode: string;
  inputs: Record<string, unknown>;
  /** Used to avoid raising a duplicate open insight for the same underlying event. */
  dedupeKey: string;
}

/**
 * Explainable, rule-based risk/insight engine (spec sections 24 & 28).
 * Deliberately NOT a black-box ML model: every insight this raises names
 * the exact rule that fired (`ruleCode`), the raw numbers it evaluated
 * (`inputs`), a plain-language "why" (`reasons`), and a recommended human
 * action — the whole point is a Finance/HR/DG user can see exactly why
 * the system flagged something and decide whether to act on it, matching
 * the seeded `PAYROLL_MOM_VARIANCE_THRESHOLD` example this module
 * reproduces live from real data.
 *
 * Every rule is idempotent: re-running detection (either via the manual
 * evaluate endpoint or automatically after payroll processing) never
 * creates a second OPEN/UNDER_REVIEW insight for the same underlying
 * event — see `raiseInsight`'s dedupe check.
 */
@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Read side -------------------------------------------------------

  async list(
    tenantId: string,
    query: QueryInsightsDto,
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    const where: Prisma.SmartInsightWhereInput = { tenantId };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.riskLevel) where.riskLevel = query.riskLevel;

    // SMART_INSIGHT_READ is DEPARTMENT-scoped for Department Heads. There
    // is no departmentId column on SmartInsight (an insight can span the
    // whole tenant), so a department-scoped caller is restricted to the
    // two categories that are ever raised about a specific department
    // (ATTENDANCE/LEAVE) AND whose `inputs.departmentId` matches their
    // own department — PAYROLL/SECURITY/WORKFORCE insights are never
    // shown to a Department Head regardless of query filters.
    if (restriction?.departmentId) {
      where.category = { in: ['ATTENDANCE', 'LEAVE'] };
      where.inputs = {
        path: ['departmentId'],
        equals: restriction.departmentId,
      };
    } else if (restriction?.onlyEmployeeId) {
      // SMART_INSIGHT_READ has no OWN grant in the matrix today, but if it
      // ever gained one, fail closed rather than showing tenant data.
      where.id = '__none__';
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.smartInsight.count({ where }),
      this.prisma.smartInsight.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { riskScore: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          reviewer: { select: { id: true, email: true } },
        },
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

  async summary(tenantId: string) {
    // Promise.all, not $transaction — see ReportsService's note on why
    // groupBy's `_count._all` typing needs a plain concurrent promise
    // rather than a $transaction-array element.
    const [open, underReview, byCategory, byRiskLevel] = await Promise.all([
      this.prisma.smartInsight.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.smartInsight.count({
        where: { tenantId, status: 'UNDER_REVIEW' },
      }),
      this.prisma.smartInsight.groupBy({
        by: ['category'],
        where: { tenantId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        _count: { _all: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.smartInsight.groupBy({
        by: ['riskLevel'],
        where: { tenantId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        _count: { _all: true },
        orderBy: { riskLevel: 'asc' },
      }),
    ]);

    return {
      openCount: open,
      underReviewCount: underReview,
      byCategory: Object.fromEntries(
        byCategory.map((r) => [r.category, r._count._all]),
      ),
      byRiskLevel: Object.fromEntries(
        byRiskLevel.map((r) => [r.riskLevel, r._count._all]),
      ),
    };
  }

  /** Fetch-then-check, never a spread-in `where` — same discipline as every other tenant-scoped lookup. */
  async review(
    tenantId: string,
    id: string,
    reviewerId: string,
    status: ReviewTargetStatus,
    reviewNote?: string,
  ) {
    const insight = await this.prisma.smartInsight.findFirst({
      where: { id, tenantId },
    });
    if (!insight) throw new NotFoundException('Smart insight not found');

    const updated = await this.prisma.smartInsight.update({
      where: { id },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? insight.reviewNote,
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId: reviewerId,
      action: 'smart-insight.reviewed',
      resourceType: 'SmartInsight',
      resourceId: id,
      metadata: { status, ruleCode: insight.ruleCode },
    });

    return updated;
  }

  private async raiseInsight(params: RaiseInsightParams) {
    // Idempotency: never raise a second open insight for the same
    // underlying event (same rule + same dedupe key) while one is still
    // OPEN or UNDER_REVIEW — re-running the detectors (manually, or
    // automatically after payroll processing) must be safe to repeat.
    const existing = await this.prisma.smartInsight.findFirst({
      where: {
        tenantId: params.tenantId,
        ruleCode: params.ruleCode,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        inputs: { path: ['dedupeKey'], equals: params.dedupeKey },
      },
    });
    if (existing) return existing;

    const riskLevel = riskLevelForScore(params.riskScore);
    const insight = await this.prisma.smartInsight.create({
      data: {
        tenantId: params.tenantId,
        category: params.category,
        title: params.title,
        riskScore: Math.round(params.riskScore),
        riskLevel,
        reasons: params.reasons,
        affectedArea: params.affectedArea,
        recommendedAction: params.recommendedAction,
        status: 'OPEN',
        ruleCode: params.ruleCode,
        inputs: {
          ...params.inputs,
          dedupeKey: params.dedupeKey,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Smart insight raised: ${params.ruleCode} (risk ${params.riskScore}, ${riskLevel})`,
    );

    // Notify the roles who can act on it: SMART_INSIGHT_REVIEW holders
    // (ADMIN/HR/FINANCE) plus DG for visibility on the executive dashboard.
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId: params.tenantId,
        status: 'ACTIVE',
        userRoles: {
          some: { role: { code: { in: ['ADMIN', 'HR', 'FINANCE', 'DG'] } } },
        },
      },
      select: { id: true },
    });
    for (const recipient of recipients) {
      await this.notifications.create({
        tenantId: params.tenantId,
        userId: recipient.id,
        category: this.notificationCategoryFor(params.category),
        severity:
          riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'WARNING' : 'INFO',
        title: params.title,
        message: `${params.reasons[0] ?? params.title} — see Smart Insights for the full explanation.`,
        link: '/intelligence',
      });
    }

    return insight;
  }

  private notificationCategoryFor(category: InsightCategory) {
    switch (category) {
      case 'PAYROLL':
        return 'PAYROLL' as const;
      case 'ATTENDANCE':
        return 'ATTENDANCE' as const;
      case 'LEAVE':
        return 'LEAVE' as const;
      case 'SECURITY':
        return 'SECURITY' as const;
      default:
        return 'WORKFORCE' as const;
    }
  }

  // ---- Rule: PAYROLL_MOM_VARIANCE_THRESHOLD -----------------------------
  //
  // Compares a just-processed payroll period's total gross pay against the
  // trailing average of up to the last 3 processed periods. Flags a
  // variance of 10% or more — the same rule shape and threshold as the
  // seeded demo insight, but computed live from whatever the tenant's
  // real payroll data says.

  async evaluatePayrollPeriod(tenantId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      include: { payrolls: true },
    });
    if (!period || period.payrolls.length === 0) return null;

    const currentGross = period.payrolls.reduce(
      (sum, p) => sum + Number(p.grossPay),
      0,
    );
    const currentOvertime = period.payrolls.reduce(
      (sum, p) => sum + Number(p.overtimePay),
      0,
    );

    const priorPeriods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId, periodStart: { lt: period.periodStart } },
      orderBy: { periodStart: 'desc' },
      take: 3,
      include: { payrolls: true },
    });
    const comparablePriors = priorPeriods.filter((p) => p.payrolls.length > 0);
    if (comparablePriors.length === 0) return null; // nothing to compare against yet

    const priorTotals = comparablePriors.map((p) =>
      p.payrolls.reduce((sum, x) => sum + Number(x.grossPay), 0),
    );
    const trailingAverageGross =
      priorTotals.reduce((a, b) => a + b, 0) / priorTotals.length;
    if (trailingAverageGross <= 0) return null;

    const priorOvertimeTotals = comparablePriors.map((p) =>
      p.payrolls.reduce((sum, x) => sum + Number(x.overtimePay), 0),
    );
    const trailingAverageOvertime =
      priorOvertimeTotals.reduce((a, b) => a + b, 0) /
      priorOvertimeTotals.length;

    const percentIncrease = round1(
      ((currentGross - trailingAverageGross) / trailingAverageGross) * 100,
    );
    const overtimeIncreasePercent =
      trailingAverageOvertime > 0
        ? round1(
            ((currentOvertime - trailingAverageOvertime) /
              trailingAverageOvertime) *
              100,
          )
        : currentOvertime > 0
          ? 100
          : 0;

    const VARIANCE_THRESHOLD_PERCENT = 10;
    if (percentIncrease < VARIANCE_THRESHOLD_PERCENT) return null;

    const compensationChangeCount =
      await this.prisma.employeeCompensation.count({
        where: {
          tenantId,
          effectiveFrom: { gte: period.periodStart, lte: period.periodEnd },
        },
      });

    // Risk band: 10-15% -> ~55 (MEDIUM), 15-25% -> ~70-80 (HIGH), 25%+ -> 90+ (CRITICAL).
    const riskScore = Math.min(97, 50 + percentIncrease * 1.6);

    const reasons = [
      `Payroll gross pay is ${percentIncrease}% above the trailing ${comparablePriors.length}-period average (${trailingAverageGross.toFixed(2)}).`,
      `${compensationChangeCount} compensation change${compensationChangeCount === 1 ? '' : 's'} took effect during this period.`,
    ];
    if (overtimeIncreasePercent >= 15) {
      reasons.push(
        `Overtime pay increased ${overtimeIncreasePercent}% compared to the trailing average.`,
      );
    }
    reasons.push(
      'The combined increase exceeds the configured historical baseline threshold.',
    );

    return this.raiseInsight({
      tenantId,
      category: 'PAYROLL',
      title: 'Payroll anomaly detected',
      riskScore,
      reasons,
      affectedArea: 'Finance / Payroll',
      recommendedAction:
        'Review recent salary adjustments and overtime records for this period before approving payroll.',
      ruleCode: 'PAYROLL_MOM_VARIANCE_THRESHOLD',
      inputs: {
        periodId: period.id,
        periodName: period.name,
        currentGross: round1(currentGross),
        trailingAverageGross: round1(trailingAverageGross),
        percentIncrease,
        compensationChangeCount,
        overtimeIncreasePercent,
      },
      dedupeKey: `period:${period.id}`,
    });
  }

  // ---- Rule: OVERTIME_DEPARTMENT_SPIKE ---------------------------------
  //
  // Compares each department's approved overtime hours in the trailing
  // 30 days against the tenant-wide average per-department overtime for
  // the same window. Flags a department whose overtime is at least double
  // the tenant average (and materially more than a token amount).

  async evaluateOvertimeSpikes(tenantId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const records = await this.prisma.overtimeRecord.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'PAID'] },
        date: { gte: since },
      },
      include: { employee: { select: { departmentId: true } } },
    });
    if (records.length === 0) return [];

    const byDept = new Map<string, number>();
    for (const r of records) {
      const deptId = r.employee.departmentId ?? '__none__';
      byDept.set(deptId, (byDept.get(deptId) ?? 0) + Number(r.hours));
    }
    const deptIds = [...byDept.keys()].filter((id) => id !== '__none__');
    if (deptIds.length < 2) return []; // need at least 2 departments to have a meaningful average

    const totalHours = [...byDept.values()].reduce((a, b) => a + b, 0);
    const averagePerDept = totalHours / byDept.size;

    const departments = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(departments.map((d) => [d.id, d.name]));

    const raised = [];
    const SPIKE_MULTIPLIER = 2;
    const MIN_HOURS_TO_FLAG = 20;
    for (const [deptId, hours] of byDept) {
      if (deptId === '__none__') continue;
      if (hours < MIN_HOURS_TO_FLAG) continue;
      if (averagePerDept <= 0 || hours < averagePerDept * SPIKE_MULTIPLIER)
        continue;

      const deptName = nameById.get(deptId) ?? 'Unknown department';
      const multiple = round1(hours / averagePerDept);
      const riskScore = Math.min(92, 45 + multiple * 10);

      const insight = await this.raiseInsight({
        tenantId,
        category: 'ATTENDANCE',
        title: `Unusual overtime volume in ${deptName}`,
        riskScore,
        reasons: [
          `${deptName} logged ${round1(hours)} approved overtime hours in the last 30 days.`,
          `That is ${multiple}x the tenant-wide average of ${round1(averagePerDept)} hours per department.`,
          'Sustained overtime at this level may indicate understaffing, scheduling issues, or unauthorized overtime claims.',
        ],
        affectedArea: `${deptName} / Attendance & Overtime`,
        recommendedAction: `Review overtime approvals and staffing levels in ${deptName}.`,
        ruleCode: 'OVERTIME_DEPARTMENT_SPIKE',
        inputs: {
          departmentId: deptId,
          departmentName: deptName,
          windowDays: 30,
          departmentHours: round1(hours),
          tenantAverageHours: round1(averagePerDept),
          multiple,
        },
        dedupeKey: `dept:${deptId}:window:${since.toISOString().slice(0, 10)}`,
      });
      raised.push(insight);
    }
    return raised;
  }

  // ---- Rule: ATTENDANCE_LATENESS_PATTERN -------------------------------
  //
  // Flags an employee whose lateness rate over the trailing 30 days of
  // recorded attendance is at or above 30%, with at least 5 records so a
  // single bad day can't trigger it.

  async evaluateLatenessPatterns(tenantId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['employeeId', 'status'],
      where: { tenantId, date: { gte: since } },
      _count: { _all: true },
      orderBy: { employeeId: 'asc' },
    });

    const byEmployee = new Map<
      string,
      { present: number; late: number; total: number }
    >();
    for (const row of grouped) {
      const entry = byEmployee.get(row.employeeId) ?? {
        present: 0,
        late: 0,
        total: 0,
      };
      if (row.status === 'PRESENT') entry.present += row._count._all;
      if (row.status === 'LATE') entry.late += row._count._all;
      if (row.status === 'PRESENT' || row.status === 'LATE')
        entry.total += row._count._all;
      byEmployee.set(row.employeeId, entry);
    }

    const LATENESS_THRESHOLD = 0.3;
    const MIN_RECORDS = 5;
    const raised = [];
    for (const [employeeId, stats] of byEmployee) {
      if (stats.total < MIN_RECORDS) continue;
      const rate = stats.late / stats.total;
      if (rate < LATENESS_THRESHOLD) continue;

      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          firstName: true,
          lastName: true,
          employeeCode: true,
          departmentId: true,
        },
      });
      if (!employee) continue;

      const ratePercent = round1(rate * 100);
      const riskScore = Math.min(88, 35 + ratePercent * 0.6);

      const insight = await this.raiseInsight({
        tenantId,
        category: 'ATTENDANCE',
        title: `Recurring lateness pattern — ${employee.firstName} ${employee.lastName}`,
        riskScore,
        reasons: [
          `${employee.firstName} ${employee.lastName} (${employee.employeeCode}) was late on ${stats.late} of ${stats.total} recorded attendance days (${ratePercent}%) in the last 30 days.`,
          'This rate is at or above the configured lateness threshold of 30%.',
        ],
        affectedArea: 'Attendance',
        recommendedAction:
          'Discuss the pattern with the employee and their manager; consider a schedule or commute review.',
        ruleCode: 'ATTENDANCE_LATENESS_PATTERN',
        inputs: {
          employeeId,
          employeeCode: employee.employeeCode,
          departmentId: employee.departmentId,
          windowDays: 30,
          lateCount: stats.late,
          totalRecords: stats.total,
          latenessRatePercent: ratePercent,
        },
        dedupeKey: `employee:${employeeId}:window:${since.toISOString().slice(0, 10)}`,
      });
      raised.push(insight);
    }
    return raised;
  }

  // ---- Rule: LEAVE_REQUEST_SURGE ----------------------------------------
  //
  // Flags a department whose leave-request volume in the trailing 30 days
  // is at least double the tenant-wide per-department average, which can
  // indicate a scheduling conflict, morale issue, or a policy loophole
  // being exploited around a specific date.

  async evaluateLeaveSurges(tenantId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const requests = await this.prisma.leaveRequest.findMany({
      where: { tenantId, createdAt: { gte: since } },
      include: { employee: { select: { departmentId: true } } },
    });
    if (requests.length === 0) return [];

    const byDept = new Map<string, number>();
    for (const r of requests) {
      const deptId = r.employee.departmentId ?? '__none__';
      byDept.set(deptId, (byDept.get(deptId) ?? 0) + 1);
    }
    const deptIds = [...byDept.keys()].filter((id) => id !== '__none__');
    if (deptIds.length < 2) return [];

    const totalRequests = [...byDept.values()].reduce((a, b) => a + b, 0);
    const averagePerDept = totalRequests / byDept.size;

    const departments = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(departments.map((d) => [d.id, d.name]));

    const SURGE_MULTIPLIER = 2;
    const MIN_REQUESTS_TO_FLAG = 4;
    const raised = [];
    for (const [deptId, count] of byDept) {
      if (deptId === '__none__') continue;
      if (count < MIN_REQUESTS_TO_FLAG) continue;
      if (averagePerDept <= 0 || count < averagePerDept * SURGE_MULTIPLIER)
        continue;

      const deptName = nameById.get(deptId) ?? 'Unknown department';
      const multiple = round1(count / averagePerDept);
      const riskScore = Math.min(80, 30 + multiple * 12);

      const insight = await this.raiseInsight({
        tenantId,
        category: 'LEAVE',
        title: `Leave request surge in ${deptName}`,
        riskScore,
        reasons: [
          `${deptName} logged ${count} leave requests in the last 30 days.`,
          `That is ${multiple}x the tenant-wide average of ${round1(averagePerDept)} requests per department.`,
          'A concentrated surge can indicate a scheduling conflict or a coverage risk for the department.',
        ],
        affectedArea: `${deptName} / Leave`,
        recommendedAction: `Review upcoming leave coverage and approval patterns in ${deptName}.`,
        ruleCode: 'LEAVE_REQUEST_SURGE',
        inputs: {
          departmentId: deptId,
          departmentName: deptName,
          windowDays: 30,
          departmentRequestCount: count,
          tenantAverageRequestCount: round1(averagePerDept),
          multiple,
        },
        dedupeKey: `dept:${deptId}:window:${since.toISOString().slice(0, 10)}`,
      });
      raised.push(insight);
    }
    return raised;
  }

  // ---- Rule: UNRESOLVED_CRITICAL_SECURITY_EVENTS ------------------------
  //
  // Flags the tenant when 3 or more HIGH/CRITICAL security events remain
  // unresolved in the trailing 7 days — a pattern rather than a single
  // one-off event (single events already page ADMIN/DG via the security
  // center directly).

  async evaluateSecurityRisk(tenantId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        tenantId,
        resolved: false,
        severity: { in: ['HIGH', 'CRITICAL'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    const THRESHOLD = 3;
    if (events.length < THRESHOLD) return null;

    const criticalCount = events.filter(
      (e) => e.severity === 'CRITICAL',
    ).length;
    const byType = new Map<string, number>();
    for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);

    const riskScore = Math.min(96, 60 + events.length * 5 + criticalCount * 5);

    return this.raiseInsight({
      tenantId,
      category: 'SECURITY',
      title: 'Multiple unresolved high-severity security events',
      riskScore,
      reasons: [
        `${events.length} HIGH/CRITICAL security events remain unresolved from the last 7 days.`,
        criticalCount > 0
          ? `${criticalCount} of these are CRITICAL severity.`
          : 'None are CRITICAL, but the volume itself exceeds the configured threshold of 3.',
        `Event types involved: ${[...byType.entries()].map(([t, c]) => `${t} (${c})`).join(', ')}.`,
      ],
      affectedArea: 'Security & Audit',
      recommendedAction:
        'Review and resolve outstanding security events in the Security Center; consider tightening access controls if a pattern points to one account.',
      ruleCode: 'UNRESOLVED_CRITICAL_SECURITY_EVENTS',
      inputs: {
        windowDays: 7,
        unresolvedCount: events.length,
        criticalCount,
        byType: Object.fromEntries(byType),
      },
      dedupeKey: `window:${since.toISOString().slice(0, 10)}`,
    });
  }

  /** Runs every tenant-wide detector once (used by the manual "run detection" endpoint). */
  async runAllDetectors(tenantId: string) {
    const [overtimeSpikes, latenessPatterns, leaveSurges, securityRisk] =
      await Promise.all([
        this.evaluateOvertimeSpikes(tenantId),
        this.evaluateLatenessPatterns(tenantId),
        this.evaluateLeaveSurges(tenantId),
        this.evaluateSecurityRisk(tenantId),
      ]);
    const raised = [
      ...overtimeSpikes,
      ...latenessPatterns,
      ...leaveSurges,
      ...(securityRisk ? [securityRisk] : []),
    ].filter((i): i is NonNullable<typeof i> => i !== null);

    return { raisedCount: raised.length, insights: raised };
  }
}
