import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeOwnedScopeRestriction } from '../rbac/scope.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async listTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  /**
   * Resolves and access-checks which employee's balances a caller may view,
   * given their granted scope restriction and an optional requested
   * employeeId (e.g. a Department Head looking up a report's balance).
   * OWN scope always wins and ignores any requested employeeId.
   */
  async resolveBalanceTarget(
    tenantId: string,
    requestedEmployeeId: string | undefined,
    callerEmployeeId: string | null,
    restriction?: EmployeeOwnedScopeRestriction,
  ): Promise<string> {
    if (restriction?.onlyEmployeeId) {
      return restriction.onlyEmployeeId;
    }

    const targetEmployeeId = requestedEmployeeId ?? callerEmployeeId ?? undefined;
    if (!targetEmployeeId) {
      throw new BadRequestException('employeeId is required.');
    }

    if (restriction?.departmentId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: targetEmployeeId, tenantId, departmentId: restriction.departmentId },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }

    return targetEmployeeId;
  }

  async listBalances(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    return this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { leaveType: { select: { id: true, name: true, code: true, paid: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    });
  }

  /**
   * Builds the list where-clause explicitly rather than by spreading a
   * restriction object into a shared shape — see the warning on
   * EmployeeOwnedScopeRestriction. OWN always wins over a query-supplied
   * employeeId; DEPARTMENT and a query employeeId are separate Prisma
   * keys (employee.departmentId vs employeeId) so they combine safely as
   * an AND rather than one silently overwriting the other.
   */
  async list(
    tenantId: string,
    query: QueryLeaveRequestsDto,
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    const where: Prisma.LeaveRequestWhereInput = { tenantId };

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

    const [total, items] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { id: true, name: true, code: true } },
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true } },
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

  private async findRaw(tenantId: string, id: string) {
    return this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: {
        leaveType: true,
        employee: { select: { id: true, firstName: true, lastName: true, departmentId: true, userId: true } },
      },
    });
  }

  /** Throws 404 if the restriction doesn't cover this specific record's employee. */
  private assertAccessible(
    record: { employeeId: string; employee: { departmentId: string | null } },
    restriction?: EmployeeOwnedScopeRestriction,
  ) {
    if (restriction?.onlyEmployeeId && restriction.onlyEmployeeId !== record.employeeId) {
      throw new NotFoundException('Leave request not found');
    }
    if (
      restriction?.departmentId &&
      !restriction.onlyEmployeeId &&
      restriction.departmentId !== record.employee.departmentId
    ) {
      throw new NotFoundException('Leave request not found');
    }
  }

  async getOne(tenantId: string, id: string, restriction?: EmployeeOwnedScopeRestriction) {
    const record = await this.findRaw(tenantId, id);
    if (!record) throw new NotFoundException('Leave request not found');
    this.assertAccessible(record, restriction);
    return record;
  }

  private daysBetweenInclusive(startDate: Date, endDate: Date): number {
    return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  }

  async create(params: {
    tenantId: string;
    employeeId: string;
    dto: CreateLeaveRequestDto;
    actorUserId: string;
  }) {
    const { tenantId, employeeId, dto, actorUserId } = params;

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after the start date.');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new BadRequestException('Start date cannot be in the past.');
    }

    const days = this.daysBetweenInclusive(startDate, endDate);

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new ConflictException('This overlaps with an existing pending or approved leave request.');
    }

    const year = startDate.getFullYear();

    return this.prisma.$transaction(async (tx) => {
      let request: Prisma.LeaveRequestGetPayload<{ include: { leaveType: true } }>;

      if (leaveType.paid) {
        const balance = await tx.leaveBalance.upsert({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year } },
          update: {},
          create: {
            tenantId,
            employeeId,
            leaveTypeId: leaveType.id,
            year,
            allocatedDays: leaveType.defaultAnnualDays,
          },
        });

        const available =
          Number(balance.allocatedDays) +
          Number(balance.carriedOverDays) -
          Number(balance.usedDays) -
          Number(balance.pendingDays);

        if (days > available) {
          throw new BadRequestException(
            `Insufficient leave balance: ${available} day(s) available, ${days} requested.`,
          );
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pendingDays: { increment: days } },
        });
      }

      request = await tx.leaveRequest.create({
        data: {
          tenantId,
          employeeId,
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          days,
          reason: dto.reason,
          status: LeaveRequestStatus.PENDING,
        },
        include: { leaveType: true },
      });

      await this.audit.record({
        tenantId,
        actorUserId,
        action: 'leave.requested',
        resourceType: 'LeaveRequest',
        resourceId: request.id,
        metadata: { leaveType: leaveType.name, days, startDate: dto.startDate, endDate: dto.endDate },
      });

      return request;
    });
  }

  async approve(params: {
    tenantId: string;
    id: string;
    actorUserId: string;
    restriction?: EmployeeOwnedScopeRestriction;
    dto: ReviewLeaveRequestDto;
  }) {
    const { tenantId, id, actorUserId, restriction, dto } = params;
    const record = await this.getOne(tenantId, id, restriction);

    if (record.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(`This request has already been ${record.status.toLowerCase()}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id: record.id },
        data: {
          status: LeaveRequestStatus.APPROVED,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          reviewComment: dto.reviewComment,
        },
        include: { leaveType: true, employee: true },
      });

      if (record.leaveType.paid) {
        const year = record.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: { employeeId: record.employeeId, leaveTypeId: record.leaveTypeId, year },
          data: {
            pendingDays: { decrement: Number(record.days) },
            usedDays: { increment: Number(record.days) },
          },
        });
      }

      return result;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'leave.approved',
      resourceType: 'LeaveRequest',
      resourceId: record.id,
      metadata: { employeeId: record.employeeId, days: Number(record.days) },
    });

    if (record.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: record.employee.userId,
        category: 'LEAVE',
        title: 'Leave request approved',
        message: `Your ${record.leaveType.name} request (${record.days} day(s)) was approved.`,
        link: `/leave/${record.id}`,
      });
    }

    return updated;
  }

  async reject(params: {
    tenantId: string;
    id: string;
    actorUserId: string;
    restriction?: EmployeeOwnedScopeRestriction;
    dto: ReviewLeaveRequestDto;
  }) {
    const { tenantId, id, actorUserId, restriction, dto } = params;
    const record = await this.getOne(tenantId, id, restriction);

    if (record.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(`This request has already been ${record.status.toLowerCase()}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id: record.id },
        data: {
          status: LeaveRequestStatus.REJECTED,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          reviewComment: dto.reviewComment,
        },
        include: { leaveType: true, employee: true },
      });

      if (record.leaveType.paid) {
        const year = record.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: { employeeId: record.employeeId, leaveTypeId: record.leaveTypeId, year },
          data: { pendingDays: { decrement: Number(record.days) } },
        });
      }

      return result;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'leave.rejected',
      resourceType: 'LeaveRequest',
      resourceId: record.id,
      metadata: { employeeId: record.employeeId, reason: dto.reviewComment },
    });

    if (record.employee.userId) {
      await this.notifications.create({
        tenantId,
        userId: record.employee.userId,
        category: 'LEAVE',
        severity: 'WARNING',
        title: 'Leave request rejected',
        message: `Your ${record.leaveType.name} request was rejected.${dto.reviewComment ? ` Reason: ${dto.reviewComment}` : ''}`,
        link: `/leave/${record.id}`,
      });
    }

    return updated;
  }

  async cancel(params: { tenantId: string; id: string; employeeId: string; actorUserId: string }) {
    const { tenantId, id, employeeId, actorUserId } = params;
    const record = await this.findRaw(tenantId, id);
    if (!record || record.employeeId !== employeeId) {
      throw new NotFoundException('Leave request not found');
    }
    if (record.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException('Only a pending request can be cancelled.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id: record.id },
        data: { status: LeaveRequestStatus.CANCELLED },
      });

      if (record.leaveType.paid) {
        const year = record.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: { employeeId: record.employeeId, leaveTypeId: record.leaveTypeId, year },
          data: { pendingDays: { decrement: Number(record.days) } },
        });
      }

      return result;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'leave.cancelled',
      resourceType: 'LeaveRequest',
      resourceId: record.id,
    });

    return updated;
  }
}
