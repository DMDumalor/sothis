import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeOwnedScopeRestriction } from '../rbac/scope.service';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { ClockActionDto } from './dto/clock-action.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';

/** Clock-ins after this local hour are marked LATE rather than PRESENT. */
const LATE_THRESHOLD_HOUR = 9;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Builds the list where-clause explicitly (never by spreading a
   * restriction object) so OWN/DEPARTMENT/query-supplied employeeId
   * combine as an AND rather than one silently overwriting another —
   * see the warning on EmployeeOwnedScopeRestriction.
   */
  async list(tenantId: string, query: QueryAttendanceDto, restriction?: EmployeeOwnedScopeRestriction) {
    const where: Prisma.AttendanceRecordWhereInput = { tenantId };

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
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true } },
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
    return this.prisma.attendanceRecord.findFirst({
      where: { id, tenantId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, departmentId: true } },
      },
    });
  }

  private assertAccessible(
    record: { employeeId: string; employee: { departmentId: string | null } },
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    if (restriction?.onlyEmployeeId && restriction.onlyEmployeeId !== record.employeeId) {
      throw new NotFoundException('Attendance record not found');
    }
    if (
      restriction?.departmentId &&
      !restriction.onlyEmployeeId &&
      restriction.departmentId !== record.employee.departmentId
    ) {
      throw new NotFoundException('Attendance record not found');
    }
  }

  async getOne(tenantId: string, id: string, restriction?: EmployeeOwnedScopeRestriction) {
    const record = await this.findRaw(tenantId, id);
    if (!record) throw new NotFoundException('Attendance record not found');
    this.assertAccessible(record, restriction);
    return record;
  }

  async clockIn(params: { tenantId: string; employeeId: string; dto: ClockActionDto; actorUserId: string }) {
    const { tenantId, employeeId, dto, actorUserId } = params;
    const now = new Date();
    const today = startOfUtcDay(now);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (existing?.clockIn) {
      throw new ConflictException('You have already clocked in today.');
    }

    const status: AttendanceStatus = now.getHours() >= LATE_THRESHOLD_HOUR ? 'LATE' : 'PRESENT';

    const record = existing
      ? await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { clockIn: now, status, notes: dto.notes },
        })
      : await this.prisma.attendanceRecord.create({
          data: { tenantId, employeeId, date: today, clockIn: now, status, notes: dto.notes },
        });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'attendance.clock_in',
      resourceType: 'AttendanceRecord',
      resourceId: record.id,
      metadata: { employeeId, status },
    });

    return record;
  }

  async clockOut(params: { tenantId: string; employeeId: string; dto: ClockActionDto; actorUserId: string }) {
    const { tenantId, employeeId, dto, actorUserId } = params;
    const now = new Date();
    const today = startOfUtcDay(now);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!existing || !existing.clockIn) {
      throw new BadRequestException('You must clock in before clocking out.');
    }
    if (existing.clockOut) {
      throw new ConflictException('You have already clocked out today.');
    }

    const workedMinutes = Math.round((now.getTime() - existing.clockIn.getTime()) / 60000);

    const record = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        clockOut: now,
        workedMinutes,
        notes: dto.notes ?? existing.notes,
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'attendance.clock_out',
      resourceType: 'AttendanceRecord',
      resourceId: record.id,
      metadata: { employeeId, workedMinutes },
    });

    return record;
  }

  /** HR/Admin manual correction — not scope-restricted beyond the caller's granted TENANT scope. */
  async correct(params: { tenantId: string; id: string; dto: CorrectAttendanceDto; actorUserId: string }) {
    const { tenantId, id, dto, actorUserId } = params;
    const existing = await this.findRaw(tenantId, id);
    if (!existing) throw new NotFoundException('Attendance record not found');

    const clockIn = dto.clockIn ? new Date(dto.clockIn) : existing.clockIn;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : existing.clockOut;
    if (clockIn && clockOut && clockOut < clockIn) {
      throw new BadRequestException('Clock-out time cannot be before clock-in time.');
    }
    const workedMinutes =
      clockIn && clockOut ? Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) : existing.workedMinutes;

    const record = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        clockIn,
        clockOut,
        workedMinutes,
        status: dto.status ?? existing.status,
        notes: dto.notes ?? existing.notes,
        source: 'MANUAL',
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'attendance.corrected',
      resourceType: 'AttendanceRecord',
      resourceId: record.id,
      metadata: { changes: JSON.parse(JSON.stringify(dto)) },
    });

    return record;
  }
}
