/**
 * SOTHIS 1618 Smart HR ERP — development/demo seed script (spec sections
 * 49-50, 57). Creates two tenants (SOTHIS-1618 as the primary demo org,
 * plus a second tenant purely so tenant-isolation tests have real data to
 * probe), the full permission catalog, roles per tenant, departments,
 * positions, demo employees + one login per role, leave/attendance/
 * overtime/payroll history for the current month (including a deliberate
 * payroll anomaly), a Smart Insight explaining that anomaly, notifications,
 * and a few audit/security-event rows so the Security Center isn't empty
 * on first login.
 *
 * Run with: npm run prisma:seed  (see package.json)
 */
import { PrismaClient, RoleCode, DocumentType, EmploymentType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { PERMISSION_CATALOG } from '../src/rbac/permissions.constants';
import { ROLE_PERMISSION_MATRIX } from '../src/rbac/role-permission-matrix';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Sothis@Demo2026';

async function seedPermissions() {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, description: perm.description },
      create: perm,
    });
  }
  console.log(`Seeded ${PERMISSION_CATALOG.length} permissions`);
}

async function seedRolesForTenant(tenantId: string) {
  const roles: Record<RoleCode, string> = {
    ADMIN: 'Administrator',
    HR: 'Human Resources',
    DEPARTMENT_HEAD: 'Department Head',
    FINANCE: 'Finance',
    DG: 'Director-General',
    EMPLOYEE: 'Employee',
  };

  const roleIds: Record<RoleCode, string> = {} as any;

  for (const code of Object.keys(roles) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: { name: roles[code] },
      create: { tenantId, code, name: roles[code], isSystem: true },
    });
    roleIds[code] = role.id;

    const grants = ROLE_PERMISSION_MATRIX[code];
    for (const grant of grants) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: grant.permission },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { scope: grant.scope },
        create: { roleId: role.id, permissionId: permission.id, scope: grant.scope },
      });
    }
  }

  console.log(`Seeded roles + permissions for tenant ${tenantId}`);
  return roleIds;
}

async function createUserWithRole(params: {
  tenantId: string;
  email: string;
  roleId: string;
  employeeId?: string;
}) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: params.tenantId, email: params.email } },
    update: {},
    create: {
      tenantId: params.tenantId,
      email: params.email,
      passwordHash,
      status: 'ACTIVE',
      passwordChangedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: params.roleId } },
    update: {},
    create: { userId: user.id, roleId: params.roleId },
  });

  if (params.employeeId) {
    await prisma.employee.update({
      where: { id: params.employeeId },
      data: { userId: user.id },
    });
  }

  return user;
}

async function seedTenantB() {
  const tenant = await prisma.tenant.upsert({
    where: { code: 'ACME-CORP' },
    update: {},
    create: { name: 'Acme Corp (Isolation Test Tenant)', code: 'ACME-CORP', timezone: 'UTC' },
  });

  const roleIds = await seedRolesForTenant(tenant.id);

  const dept = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OPS' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Operations', code: 'OPS' },
  });

  const position = await prisma.position.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OPS-ANALYST' } },
    update: {},
    create: { tenantId: tenant.id, title: 'Operations Analyst', code: 'OPS-ANALYST', departmentId: dept.id },
  });

  const employee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'EMP-B0001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      employeeCode: 'EMP-B0001',
      firstName: 'Grace',
      lastName: 'Owusu',
      email: 'grace.owusu@acmecorp.example',
      departmentId: dept.id,
      positionId: position.id,
      employmentType: EmploymentType.FULL_TIME,
      startDate: new Date('2024-01-15'),
    },
  });

  await createUserWithRole({
    tenantId: tenant.id,
    email: 'hr@acmecorp.example',
    roleId: roleIds.HR,
    employeeId: employee.id,
  });

  console.log('Seeded isolation-test tenant ACME-CORP');
  return tenant;
}

async function main() {
  console.log('--- SOTHIS 1618 seed starting ---');

  await seedPermissions();

  const tenant = await prisma.tenant.upsert({
    where: { code: 'SOTHIS-1618' },
    update: {},
    create: { name: 'SOTHIS 1618', code: 'SOTHIS-1618', timezone: 'Africa/Accra' },
  });

  const roleIds = await seedRolesForTenant(tenant.id);

  // ---- Departments ----------------------------------------------------
  const departmentDefs = [
    { name: 'Human Resources', code: 'HR' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Operations', code: 'OPS' },
    { name: 'Administration', code: 'ADMIN' },
  ];
  const departments: Record<string, string> = {};
  for (const d of departmentDefs) {
    const dept = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: d.code } },
      update: {},
      create: { tenantId: tenant.id, name: d.name, code: d.code },
    });
    departments[d.code] = dept.id;
  }

  // ---- Positions --------------------------------------------------------
  const positionDefs = [
    { title: 'HR Manager', code: 'HR-MGR', dept: 'HR' },
    { title: 'HR Officer', code: 'HR-OFF', dept: 'HR' },
    { title: 'Finance Manager', code: 'FIN-MGR', dept: 'FIN' },
    { title: 'Payroll Officer', code: 'FIN-PAY', dept: 'FIN' },
    { title: 'IT Department Head', code: 'IT-HEAD', dept: 'IT' },
    { title: 'Software Developer', code: 'IT-DEV', dept: 'IT' },
    { title: 'Systems Administrator', code: 'IT-SYSADMIN', dept: 'IT' },
    { title: 'Operations Manager', code: 'OPS-MGR', dept: 'OPS' },
    { title: 'Operations Associate', code: 'OPS-ASSOC', dept: 'OPS' },
    { title: 'Director-General', code: 'DG', dept: 'ADMIN' },
    { title: 'Platform Administrator', code: 'SYS-ADMIN', dept: 'ADMIN' },
  ];
  const positions: Record<string, string> = {};
  for (const p of positionDefs) {
    const pos = await prisma.position.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        title: p.title,
        code: p.code,
        departmentId: departments[p.dept],
      },
    });
    positions[p.code] = pos.id;
  }

  // ---- Core demo employees (one per primary role) ------------------------
  type EmpDef = {
    code: string;
    first: string;
    last: string;
    email: string;
    dept: string;
    pos: string;
    role: RoleCode;
    loginEmail: string;
  };
  const coreEmployees: EmpDef[] = [
    { code: 'EMP-00001', first: 'Daniel', last: 'Mensah', email: 'daniel.mensah@sothis1618.com', dept: 'HR', pos: 'HR-MGR', role: 'HR', loginEmail: 'hr@sothis1618.com' },
    { code: 'EMP-00002', first: 'Kofi', last: 'Asante', email: 'kofi.asante@sothis1618.com', dept: 'IT', pos: 'IT-HEAD', role: 'DEPARTMENT_HEAD', loginEmail: 'depthead@sothis1618.com' },
    { code: 'EMP-00003', first: 'Abena', last: 'Quarcoo', email: 'abena.quarcoo@sothis1618.com', dept: 'FIN', pos: 'FIN-MGR', role: 'FINANCE', loginEmail: 'finance@sothis1618.com' },
    { code: 'EMP-00004', first: 'Nana', last: 'Adjei', email: 'nana.adjei@sothis1618.com', dept: 'ADMIN', pos: 'DG', role: 'DG', loginEmail: 'dg@sothis1618.com' },
    { code: 'EMP-00005', first: 'Yaw', last: 'Boateng', email: 'yaw.boateng@sothis1618.com', dept: 'ADMIN', pos: 'SYS-ADMIN', role: 'ADMIN', loginEmail: 'admin@sothis1618.com' },
    { code: 'EMP-00006', first: 'John', last: 'Mensah', email: 'john.mensah@sothis1618.com', dept: 'IT', pos: 'IT-DEV', role: 'EMPLOYEE', loginEmail: 'employee@sothis1618.com' },
  ];

  // Extra rank-and-file employees so lists/reports/charts look like a real org.
  const extraEmployees: Array<Omit<EmpDef, 'role' | 'loginEmail'>> = [
    { code: 'EMP-00007', first: 'Ama', last: 'Darko', email: 'ama.darko@sothis1618.com', dept: 'IT', pos: 'IT-DEV' },
    { code: 'EMP-00008', first: 'Kwesi', last: 'Appiah', email: 'kwesi.appiah@sothis1618.com', dept: 'IT', pos: 'IT-SYSADMIN' },
    { code: 'EMP-00009', first: 'Efua', last: 'Owusu', email: 'efua.owusu@sothis1618.com', dept: 'OPS', pos: 'OPS-MGR' },
    { code: 'EMP-00010', first: 'Kwame', last: 'Boadi', email: 'kwame.boadi@sothis1618.com', dept: 'OPS', pos: 'OPS-ASSOC' },
    { code: 'EMP-00011', first: 'Akosua', last: 'Frimpong', email: 'akosua.frimpong@sothis1618.com', dept: 'OPS', pos: 'OPS-ASSOC' },
    { code: 'EMP-00012', first: 'Yaa', last: 'Sarpong', email: 'yaa.sarpong@sothis1618.com', dept: 'HR', pos: 'HR-OFF' },
    { code: 'EMP-00013', first: 'Kojo', last: 'Antwi', email: 'kojo.antwi@sothis1618.com', dept: 'FIN', pos: 'FIN-PAY' },
  ];

  const employeeIds: Record<string, string> = {};

  for (const e of coreEmployees) {
    const employee = await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: e.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeCode: e.code,
        firstName: e.first,
        lastName: e.last,
        email: e.email,
        phone: '+233 20 000 0000',
        departmentId: departments[e.dept],
        positionId: positions[e.pos],
        employmentType: EmploymentType.FULL_TIME,
        startDate: new Date('2022-03-01'),
      },
    });
    employeeIds[e.code] = employee.id;

    await createUserWithRole({
      tenantId: tenant.id,
      email: e.loginEmail,
      roleId: roleIds[e.role],
      employeeId: employee.id,
    });
  }

  for (const e of extraEmployees) {
    const employee = await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: e.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeCode: e.code,
        firstName: e.first,
        lastName: e.last,
        email: e.email,
        phone: '+233 24 000 0000',
        departmentId: departments[e.dept],
        positionId: positions[e.pos],
        employmentType: EmploymentType.FULL_TIME,
        startDate: new Date('2023-06-01'),
      },
    });
    employeeIds[e.code] = employee.id;
  }

  // Assign department heads.
  await prisma.department.update({
    where: { id: departments['IT'] },
    data: { headEmployeeId: employeeIds['EMP-00002'] },
  });
  await prisma.department.update({
    where: { id: departments['HR'] },
    data: { headEmployeeId: employeeIds['EMP-00001'] },
  });
  await prisma.department.update({
    where: { id: departments['FIN'] },
    data: { headEmployeeId: employeeIds['EMP-00003'] },
  });

  // Set managers for IT team.
  await prisma.employee.updateMany({
    where: { id: { in: [employeeIds['EMP-00006'], employeeIds['EMP-00007'], employeeIds['EMP-00008']] } },
    data: { managerId: employeeIds['EMP-00002'] },
  });

  // ---- Leave types & balances --------------------------------------------
  const leaveTypeDefs = [
    { code: 'ANNUAL', name: 'Annual Leave', defaultAnnualDays: 25, paid: true },
    { code: 'SICK', name: 'Sick Leave', defaultAnnualDays: 10, paid: true },
    { code: 'MATERNITY', name: 'Maternity Leave', defaultAnnualDays: 90, paid: true },
    { code: 'UNPAID', name: 'Unpaid Leave', defaultAnnualDays: 0, paid: false },
  ];
  const leaveTypes: Record<string, string> = {};
  for (const lt of leaveTypeDefs) {
    const type = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: lt.code } },
      update: {},
      create: { tenantId: tenant.id, ...lt },
    });
    leaveTypes[lt.code] = type.id;
  }

  const year = new Date().getFullYear();
  for (const empId of Object.values(employeeIds)) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empId,
          leaveTypeId: leaveTypes['ANNUAL'],
          year,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeId: empId,
        leaveTypeId: leaveTypes['ANNUAL'],
        year,
        allocatedDays: 25,
        usedDays: 7,
        pendingDays: 0,
      },
    });
  }

  // A few pending/approved leave requests for the demo workflow.
  await prisma.leaveRequest.createMany({
    data: [
      {
        tenantId: tenant.id,
        employeeId: employeeIds['EMP-00006'],
        leaveTypeId: leaveTypes['ANNUAL'],
        startDate: new Date(Date.now() + 3 * 86400000),
        endDate: new Date(Date.now() + 5 * 86400000),
        days: 3,
        reason: 'Family event',
        status: 'PENDING',
      },
      {
        tenantId: tenant.id,
        employeeId: employeeIds['EMP-00007'],
        leaveTypeId: leaveTypes['SICK'],
        startDate: new Date(Date.now() - 10 * 86400000),
        endDate: new Date(Date.now() - 9 * 86400000),
        days: 2,
        reason: 'Flu',
        status: 'APPROVED',
        reviewedById: null,
        reviewComment: 'Approved, get well soon.',
      },
    ],
    skipDuplicates: true,
  });

  // ---- Attendance (last 10 working days for the IT team) -----------------
  const itTeam = [employeeIds['EMP-00002'], employeeIds['EMP-00006'], employeeIds['EMP-00007'], employeeIds['EMP-00008']];
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    for (const empId of itTeam) {
      const late = Math.random() < 0.12;
      const clockIn = new Date(date);
      clockIn.setHours(late ? 9 : 8, late ? 20 : 0, 0, 0);
      const clockOut = new Date(date);
      clockOut.setHours(17, 0, 0, 0);

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        update: {},
        create: {
          tenantId: tenant.id,
          employeeId: empId,
          date,
          clockIn,
          clockOut,
          status: late ? 'LATE' : 'PRESENT',
          workedMinutes: 8 * 60 - (late ? 20 : 0),
          source: 'SYSTEM',
        },
      });
    }
  }

  // ---- Overtime (feeds the payroll anomaly) -------------------------------
  const overtimeRecords = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i + 2));
    overtimeRecords.push(
      prisma.overtimeRecord.create({
        data: {
          tenantId: tenant.id,
          employeeId: itTeam[i % itTeam.length],
          date,
          hours: 4 + (i % 3),
          reason: 'Production incident response',
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      }),
    );
  }
  await Promise.all(overtimeRecords);

  // ---- Users referenced by later seed steps (notifications, createdBy) ---
  const financeUser = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: 'finance@sothis1618.com' } } });
  const dgUser = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: 'dg@sothis1618.com' } } });
  const hrUser = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: 'hr@sothis1618.com' } } });
  const deptHeadUser = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: 'depthead@sothis1618.com' } } });

  // ---- Compensation & payroll (this month, with a deliberate anomaly) ----
  const compensationDefs: Array<[string, number]> = [
    ['EMP-00001', 8500],
    ['EMP-00002', 9200],
    ['EMP-00003', 9800],
    ['EMP-00004', 15000],
    ['EMP-00005', 8800],
    ['EMP-00006', 6200],
    ['EMP-00007', 6000],
    ['EMP-00008', 6400],
    ['EMP-00009', 7200],
    ['EMP-00010', 4800],
    ['EMP-00011', 4800],
    ['EMP-00012', 5200],
    ['EMP-00013', 5600],
  ];
  for (const [code, base] of compensationDefs) {
    await prisma.employeeCompensation.upsert({
      where: {
        id: `seed-comp-${code}`, // deterministic pseudo-id via findFirst fallback below
      },
      update: {},
      create: {
        id: `seed-comp-${code}`,
        tenantId: tenant.id,
        employeeId: employeeIds[code],
        baseSalary: base,
        currency: 'GHS',
        effectiveFrom: new Date('2025-01-01'),
        createdById: financeUser!.id,
      },
    });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodName = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const payrollPeriod = await prisma.payrollPeriod.upsert({
    where: { tenantId_periodStart_periodEnd: { tenantId: tenant.id, periodStart, periodEnd } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: periodName,
      periodStart,
      periodEnd,
      status: 'UNDER_REVIEW',
      createdById: financeUser!.id,
    },
  });

  let totalGross = 0;
  let totalNet = 0;
  for (const [code, base] of compensationDefs) {
    const overtimePay = itTeam.includes(employeeIds[code]) ? base * 0.12 : 0;
    const allowances = base * 0.15;
    const grossPay = base + overtimePay + allowances;
    const deductions = grossPay * 0.18;
    const netPay = grossPay - deductions;
    totalGross += grossPay;
    totalNet += netPay;

    const payroll = await prisma.payroll.upsert({
      where: { payrollPeriodId_employeeId: { payrollPeriodId: payrollPeriod.id, employeeId: employeeIds[code] } },
      update: {},
      create: {
        tenantId: tenant.id,
        payrollPeriodId: payrollPeriod.id,
        employeeId: employeeIds[code],
        baseSalary: base,
        overtimePay,
        totalAllowances: allowances,
        totalDeductions: deductions,
        grossPay,
        netPay,
        status: 'UNDER_REVIEW',
        calculatedAt: new Date(),
      },
    });

    await prisma.payrollAllowance.createMany({
      data: [{ payrollId: payroll.id, label: 'Housing & Transport Allowance', amount: allowances }],
      skipDuplicates: true,
    });
    await prisma.payrollDeduction.createMany({
      data: [
        { payrollId: payroll.id, label: 'Income Tax', amount: deductions * 0.7 },
        { payrollId: payroll.id, label: 'Pension (SSNIT)', amount: deductions * 0.3 },
      ],
      skipDuplicates: true,
    });
  }

  console.log(`Seeded payroll period "${periodName}": gross ${totalGross.toFixed(2)}, net ${totalNet.toFixed(2)}`);

  // ---- Smart Insight: the canonical payroll anomaly from spec §24/§28 ----
  await prisma.smartInsight.create({
    data: {
      tenantId: tenant.id,
      category: 'PAYROLL',
      title: 'Payroll anomaly detected',
      riskScore: 78,
      riskLevel: 'HIGH',
      reasons: [
        'Payroll increased 10.6% compared to the trailing 3-month average',
        '8 salary/compensation changes occurred this period',
        'Overtime hours increased 18% in the IT department',
        'The combined increase exceeds the configured historical baseline threshold',
      ],
      affectedArea: 'Finance / Payroll',
      recommendedAction: 'Review recent salary adjustments and overtime records for the IT department before approving this payroll period.',
      status: 'OPEN',
      ruleCode: 'PAYROLL_MOM_VARIANCE_THRESHOLD',
      inputs: {
        periodId: payrollPeriod.id,
        currentGross: totalGross,
        trailingAverageGross: totalGross / 1.106,
        percentIncrease: 10.6,
        compensationChangeCount: 8,
        overtimeIncreasePercent: 18,
      },
    },
  });

  // ---- Notifications -------------------------------------------------
  const notifications = [
    financeUser && { userId: financeUser.id, category: 'PAYROLL', severity: 'WARNING', title: 'Payroll variance detected', message: `Payroll for ${periodName} is 10.6% above the historical average. Review before approval.` },
    dgUser && { userId: dgUser.id, category: 'WORKFORCE', severity: 'INFO', title: 'Executive insight available', message: 'Organization payroll increased significantly this month — see Smart Insights.' },
    hrUser && { userId: hrUser.id, category: 'DOCUMENT_EXPIRY', severity: 'INFO', title: 'Documents expiring soon', message: '3 employee documents expire within 30 days.' },
    deptHeadUser && { userId: deptHeadUser.id, category: 'LEAVE', severity: 'INFO', title: 'Leave requests need review', message: '1 leave request in your department is pending review.' },
  ].filter(Boolean) as any[];

  for (const n of notifications) {
    await prisma.notification.create({ data: { tenantId: tenant.id, ...n } });
  }

  // ---- Sample audit logs / security events ----------------------------
  await prisma.auditLog.createMany({
    data: [
      { tenantId: tenant.id, actorUserId: hrUser?.id, action: 'employee.created', resourceType: 'Employee', resourceId: employeeIds['EMP-00006'], metadata: { employeeCode: 'EMP-00006' } },
      { tenantId: tenant.id, actorUserId: financeUser?.id, action: 'payroll.calculated', resourceType: 'PayrollPeriod', resourceId: payrollPeriod.id, metadata: { periodName } },
    ],
  });

  await prisma.securityEvent.createMany({
    data: [
      { tenantId: tenant.id, type: 'REPEATED_FAILED_LOGIN', severity: 'MEDIUM', description: '3 failed login attempts detected for an account within 5 minutes.' },
      { tenantId: tenant.id, type: 'SUSPICIOUS_ROLE_CHANGE', severity: 'HIGH', description: "A user's role was changed to ADMIN outside business hours.", resolved: false },
    ],
  });

  // ---- Second tenant for isolation testing (spec section 48) -------------
  await seedTenantB();

  console.log('--- SOTHIS 1618 seed complete ---');
  console.log(`Demo password for every seeded user: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
