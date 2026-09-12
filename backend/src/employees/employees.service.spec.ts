import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';

/**
 * Regression coverage for the OWN-scope authorization guard in `findOne`.
 *
 * A real bug shipped here once: `findOne` merged
 * `{ id, tenantId, ...buildScopeWhere(restriction) }`, and
 * `buildScopeWhere` returned `{ id: restriction.onlyEmployeeId }` for an
 * OWN-scope caller. Because the spread came AFTER the explicit `id`, it
 * silently overrode the caller-requested id instead of rejecting a
 * mismatch — so a self-service EMPLOYEE could pass ANY employee id in the
 * URL and Prisma would happily return their own record instead of 404ing.
 * Nothing about that response looked wrong in isolation (a valid employee
 * came back), which is exactly why it needs a standing test rather than
 * relying on manual smoke-testing to catch it again.
 */
describe('EmployeesService — scope restriction', () => {
  const tenantId = 'tenant-1';
  const selfEmployeeId = 'emp-self';
  const otherEmployeeId = 'emp-other';

  let prisma: { employee: { findFirst: jest.Mock; count: jest.Mock; findMany: jest.Mock } };
  let audit: { record: jest.Mock };
  let service: EmployeesService;

  beforeEach(() => {
    prisma = {
      employee: {
        findFirst: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = { record: jest.fn() };
    // Cast through unknown: only the methods this service actually calls
    // are exercised, so a full PrismaService mock would just be noise.
    service = new EmployeesService(prisma as any, audit as any);
  });

  it('OWN scope: allows fetching the caller\'s own employee record', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: selfEmployeeId, tenantId });

    const result = await service.findOne(tenantId, selfEmployeeId, {
      onlyEmployeeId: selfEmployeeId,
    });

    expect(result).toEqual({ id: selfEmployeeId, tenantId });
    // The where clause actually sent to Prisma must still pin the
    // requested id — not silently substitute a different one.
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: selfEmployeeId, tenantId }),
      }),
    );
  });

  it('OWN scope: rejects fetching a DIFFERENT employee\'s record with 404, without querying Prisma', async () => {
    await expect(
      service.findOne(tenantId, otherEmployeeId, { onlyEmployeeId: selfEmployeeId }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // The guard must short-circuit before hitting the database at all —
    // there is nothing legitimate an OWN-scope caller can learn about a
    // record that isn't theirs, not even its existence.
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('DEPARTMENT scope: includes the department restriction in the query and does not touch id', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: otherEmployeeId, tenantId });

    await service.findOne(tenantId, otherEmployeeId, { departmentId: 'dept-1' });

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: otherEmployeeId,
          tenantId,
          departmentId: 'dept-1',
        }),
      }),
    );
  });

  it('TENANT scope (no restriction): fetches by id and tenant only', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: otherEmployeeId, tenantId });

    await service.findOne(tenantId, otherEmployeeId, undefined);

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: otherEmployeeId, tenantId } }),
    );
  });

  it('findOne throws 404 when Prisma finds no matching row', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.findOne(tenantId, otherEmployeeId, undefined)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
