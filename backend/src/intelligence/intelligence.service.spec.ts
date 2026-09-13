import { IntelligenceService } from './intelligence.service';

/**
 * Coverage for the PAYROLL_MOM_VARIANCE_THRESHOLD rule — the one
 * explainable insight the seed data guarantees exists
 * (prisma/seed.ts), so this rule must be able to reproduce it live from
 * real payroll data, not just as a hardcoded seed row. These tests pin
 * down: (1) it fires only when the trailing-average variance crosses the
 * 10% threshold, (2) every insight carries the raw numbers it evaluated
 * for explainability, and (3) re-running detection against the same
 * period never creates a second OPEN insight (idempotency — see
 * `raiseInsight`'s dedupe check).
 */
describe('IntelligenceService — PAYROLL_MOM_VARIANCE_THRESHOLD', () => {
  const tenantId = 'tenant-1';
  const periodId = 'period-current';

  let prisma: {
    payrollPeriod: { findFirst: jest.Mock; findMany: jest.Mock };
    employeeCompensation: { count: jest.Mock };
    smartInsight: { findFirst: jest.Mock; create: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let notifications: { create: jest.Mock };
  let audit: { record: jest.Mock };
  let service: IntelligenceService;

  function payroll(grossPay: number, overtimePay = 0) {
    return { grossPay, overtimePay };
  }

  beforeEach(() => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn(), findMany: jest.fn() },
      employeeCompensation: { count: jest.fn().mockResolvedValue(0) },
      smartInsight: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { create: jest.fn() };
    audit = { record: jest.fn() };
    // Cast through unknown/any: only the methods this rule actually calls
    // are exercised, so a full PrismaService mock would just be noise.
    service = new IntelligenceService(
      prisma as any,
      audit as any,
      notifications as any,
    );
  });

  it('does nothing when there are no prior periods to compare against', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      periodStart: new Date('2026-09-01'),
      payrolls: [payroll(10000)],
    });
    prisma.payrollPeriod.findMany.mockResolvedValue([]);

    const result = await service.evaluatePayrollPeriod(tenantId, periodId);

    expect(result).toBeNull();
    expect(prisma.smartInsight.create).not.toHaveBeenCalled();
  });

  it('does nothing when the variance is below the 10% threshold', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      periodStart: new Date('2026-09-01'),
      payrolls: [payroll(10500)], // +5% vs. the 10,000 trailing average
    });
    prisma.payrollPeriod.findMany.mockResolvedValue([
      { payrolls: [payroll(10000)] },
    ]);

    const result = await service.evaluatePayrollPeriod(tenantId, periodId);

    expect(result).toBeNull();
    expect(prisma.smartInsight.create).not.toHaveBeenCalled();
  });

  it('raises an explainable PAYROLL insight when the variance crosses the threshold', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      name: 'September 2026',
      periodStart: new Date('2026-09-01'),
      payrolls: [payroll(6000, 600), payroll(5060, 0)], // gross 11,060 vs. avg 10,000 = +10.6%
    });
    prisma.payrollPeriod.findMany.mockResolvedValue([
      { payrolls: [payroll(10000, 100)] },
    ]);
    prisma.employeeCompensation.count.mockResolvedValue(8);
    prisma.smartInsight.create.mockImplementation(({ data }) => ({
      id: 'insight-1',
      ...data,
    }));

    const result = await service.evaluatePayrollPeriod(tenantId, periodId);

    expect(prisma.smartInsight.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.smartInsight.create.mock.calls[0][0];
    expect(createArgs.data.ruleCode).toBe('PAYROLL_MOM_VARIANCE_THRESHOLD');
    expect(createArgs.data.category).toBe('PAYROLL');
    expect(createArgs.data.status).toBe('OPEN');
    // Explainability: the raw numbers the rule evaluated must be on the
    // record, not just a risk score.
    expect(createArgs.data.inputs).toMatchObject({
      periodId,
      currentGross: 11060,
      trailingAverageGross: 10000,
      percentIncrease: 10.6,
      compensationChangeCount: 8,
    });
    expect(createArgs.data.reasons.length).toBeGreaterThan(0);
    expect(result).toBeTruthy();
  });

  it('never raises a second OPEN insight for the same period (idempotent re-run)', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      name: 'September 2026',
      periodStart: new Date('2026-09-01'),
      payrolls: [payroll(11060)],
    });
    prisma.payrollPeriod.findMany.mockResolvedValue([
      { payrolls: [payroll(10000)] },
    ]);
    // Simulate an insight already raised for this exact period (dedupeKey match).
    prisma.smartInsight.findFirst.mockResolvedValue({ id: 'existing-insight' });

    const result = await service.evaluatePayrollPeriod(tenantId, periodId);

    expect(result).toEqual({ id: 'existing-insight' });
    expect(prisma.smartInsight.create).not.toHaveBeenCalled();
  });
});
