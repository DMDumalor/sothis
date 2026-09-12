import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeOwnedScopeRestriction } from '../rbac/scope.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class OvertimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Explicit where-clause construction (never spread a restriction into an
   * existing key) — see the warning on EmployeeOwnedScopeRestriction.
   */
  async list(tenantId: string, query: QueryOvertimeDto, restriction?: EmployeeOwnedScopeRestriction) {
    const where: Prisma.OvertimeRecordWhereInput = { tenantId };

    if (restriction?.onlyEmployeeId) {
      where.employeeId = restriction.onlyEmployeeId;
    } else {
      if (restriction?.departmentId) {
        where.employee = { departmentId: restriction.departmentId };
      }
      if (query.employeeId) {
        where.employeeId = query.employeeId;
      }
    }

    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom ? { gte: startOfUtcDay(new Date(query.dateFrom)) } : {}),
        ...(query.dateTo ? { lte: startOfUtcDay(new Date(query.dateTo)) } : {}),
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.overtimeRecord.count({ where }),
      this.prisma.overtimeRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true, userId: true } },
        },
        orderBy: { date: 'desc' },
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

  private async findRaw(tenantId: string, id: string) {
    return this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, departmentId: true, userId: true } },
      },
    });
  }

  private assertAccessible(
    record: { employeeId: string; employee: { departmentId: string | null } },
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    if (restriction?.onlyEmployeeId && restriction.onlyEmployeeId !== record.employeeId) {
      throw new NotFoundException('Overtime record not found');
    }
    if (
      restriction?.departmentId &&
      !restriction.onlyEmployeeId &&
      restriction.departmentId !== record.employee.departmentId
    ) {
      throw new NotFoundException('Overtime record not found');
    }
  }

  async getOne(tenantId: string, id: string, restriction?: EmployeeOwnedScopeRestriction) {
    const record = await this.findRaw(tenantId, id);
    if (!record) throw new NotFoundException('Overtime record not found');
    this.assertAccessible(record, restriction);
    return record;
  }

  async create(params: { tenantId: string; employeeId: string; dto: CreateOvertimeDto; actorUserId: string }) {
    const { tenantId, employeeId, dto, actorUserId } = params;

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date.');
    }
    const today = startOfUtcDay(new Date());
    if (startOfUtcDay(date) > today) {
      throw new BadRequestException('Overtime cannot be submitted for a future date.');
    }

    if (dto.attendanceRecordId) {
      const attendance = await this.prisma.attendanceRecord.findFirst({
        where: { id: dto.attendanceRecordId, tenantId, employeeId },
      });
      if (!attendance) {
        throw new BadRequestException('Referenced attendance record was not found for this employee.');
      }
    }

    const record = await this.prisma.overtimeRecord.create({
      data: {
        tenantId,
        employeeId,
        date: startOfUtcDay(date),
        hours: dto.hours,
        reason: dto.reason,
        attendanceRecordId: dto.attendanceRecordId,
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'overtime.submitted',
      resourceType: 'OvertimeRecord',
      resourceId: record.id,
      metadata: { employeeId, hours: dto.hours, date: dto.date },
    });

    return record;
  }

  async approve(params: {
    tenantId: string;
    id: string;
    actorUserId: string;
    restriction?: EmployeeOwnedScopeRestriction;
  }) {
    const { tenantId, id, actorUserId, restriction } = params;
    const record = await this.getOne(tenantId, id, restriction);

    if (record.status !== 'PENDING') {
      throw new ConflictException(`This overtime record has already been ${record.status.toLowerCase()}.`);
    }

    const updated = await this.prisma.overtimeRecord.update({
      where: { id: record.id },
      data: { status: 'APPROVED', reviewedById: actorUserId, reviewedAt: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'overtime.approved',
      resourceType: 'OvertimeRecord',
      resourceId: record.id,
      metadata: { employeeId: record.employeeId, hours: Number(record.hours) },
    });

    if (record.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: record.employee.userId,
        category: 'OVERTIME',
        title: 'Overtime approved',
        message: `Your overtime submission for ${Number(record.hours)} hour(s) was approved.`,
        link: `/overtime`,
      });
    }

    return updated;
  }

  async reject(params: {
    tenantId: string;
    id: string;
    actorUserId: string;
    restriction?: EmployeeOwnedScopeRestriction;
  }) {
    const { tenantId, id, actorUserId, restriction } = params;
    const record = await this.getOne(tenantId, id, restriction);

    if (record.status !== 'PENDING') {
      throw new ConflictException(`This overtime record has already been ${record.status.toLowerCase()}.`);
    }

    const updated = await this.prisma.overtimeRecord.update({
      where: { id: record.id },
      data: { status: 'REJECTED', reviewedById: actorUserId, reviewedAt: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'overtime.rejected',
      resourceType: 'OvertimeRecord',
      resourceId: record.id,
      metadata: { employeeId: record.employeeId },
    });

    if (record.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: record.employee.userId,
        category: 'OVERTIME',
        severity: 'WARNING',
        title: 'Overtime rejected',
        message: `Your overtime submission for ${Number(record.hours)} hour(s) was rejected.`,
        link: `/overtime`,
      });
    }

    return updated;
  }
}
