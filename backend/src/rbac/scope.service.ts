import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Small shared helper for turning "this caller's grant is DEPARTMENT-
 * scoped" into an actual department id to filter by. Kept in one place so
 * every module (departments, employees, leave, attendance, ...) resolves
 * "the caller's own department" the same way: the department of their own
 * employee record.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnDepartmentId(employeeId: string | null): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });
    return employee?.departmentId ?? null;
  }
}
