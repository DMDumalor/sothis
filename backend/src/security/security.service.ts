import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QuerySecurityEventsDto } from './dto/query-security-events.dto';

/**
 * Security & Audit Center read model (spec sections 14 & 40). Both
 * AUDIT_READ and SECURITY_READ are granted TENANT-only (ADMIN and DG),
 * so unlike most other modules there is no OWN/DEPARTMENT branch here —
 * every query is always scoped to the caller's tenantId and nothing
 * narrower or wider.
 *
 * This service never exposes update/delete for audit logs (append-only,
 * per AuditService's own contract). Security events support a single
 * "resolve" mutation — acknowledging that a flagged pattern was reviewed
 * — gated by the same SECURITY_READ permission at the controller since
 * the catalog has no separate security-management permission and both
 * roles that hold it are already the platform's most trusted.
 */
@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(tenantId: string, query: QueryAuditLogsDto) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.action
        ? { action: { contains: query.action, mode: 'insensitive' } }
        : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          actor: {
            select: { id: true, email: true },
          },
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

  async listSecurityEvents(tenantId: string, query: QuerySecurityEventsDto) {
    const where: Prisma.SecurityEventWhereInput = {
      tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
    };

    const [total, unresolvedCount, items] = await this.prisma.$transaction([
      this.prisma.securityEvent.count({ where }),
      this.prisma.securityEvent.count({ where: { tenantId, resolved: false } }),
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      }),
    ]);

    return {
      items,
      unresolvedCount,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async summary(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Promise.all, not $transaction — see ReportsService's note on why
    // groupBy's `_count._all` typing needs a plain concurrent promise
    // rather than a $transaction-array element.
    const [
      unresolvedCount,
      criticalUnresolvedCount,
      eventsLast24h,
      auditLast24h,
      bySeverity,
    ] = await Promise.all([
      this.prisma.securityEvent.count({ where: { tenantId, resolved: false } }),
      this.prisma.securityEvent.count({
        where: { tenantId, resolved: false, severity: 'CRITICAL' },
      }),
      this.prisma.securityEvent.count({
        where: { tenantId, createdAt: { gte: since24h } },
      }),
      this.prisma.auditLog.count({
        where: { tenantId, createdAt: { gte: since24h } },
      }),
      this.prisma.securityEvent.groupBy({
        by: ['severity'],
        where: { tenantId, resolved: false },
        _count: { _all: true },
        orderBy: { severity: 'asc' },
      }),
    ]);

    return {
      unresolvedCount,
      criticalUnresolvedCount,
      eventsLast24h,
      auditActionsLast24h: auditLast24h,
      unresolvedBySeverity: Object.fromEntries(
        bySeverity.map((row) => [row.severity, row._count._all]),
      ),
    };
  }

  /** Fetch-then-check, never a spread-in `where` — same discipline as every other tenant-scoped lookup. */
  async resolveSecurityEvent(
    tenantId: string,
    id: string,
    resolvedById: string,
    resolveNote?: string,
  ) {
    const event = await this.prisma.securityEvent.findFirst({
      where: { id, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Security event not found');
    }
    if (event.resolved) {
      return event;
    }
    return this.prisma.securityEvent.update({
      where: { id },
      data: {
        resolved: true,
        resolvedById,
        resolvedAt: new Date(),
        metadata: resolveNote
          ? ({
              ...(event.metadata as object),
              resolveNote,
            } as Prisma.InputJsonValue)
          : (event.metadata ?? undefined),
      },
    });
  }
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}
