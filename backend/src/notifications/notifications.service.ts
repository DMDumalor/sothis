import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Thin in-app notification writer, reused by every module whose workflow
 * ends with "notification sent" per the spec's business workflows (leave
 * decisions, overtime decisions, and eventually payroll/document-expiry/
 * security alerts in later milestones). A full notifications inbox
 * UI/read-state API lands in M5 — this is deliberately just the write
 * side so workflows aren't blocked waiting for that.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateNotificationParams) {
    try {
      await this.prisma.notification.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          category: params.category,
          severity: params.severity ?? 'INFO',
          title: params.title,
          message: params.message,
          link: params.link,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      // A notification failing to write must never take down the
      // workflow action that triggered it (approval, rejection, etc).
      this.logger.error(
        `Failed to create notification for user ${params.userId}: ${error}`,
      );
    }
  }

  // ---- Read side (M5 — notifications inbox) --------------------------
  //
  // Notifications are always scoped to `req.user.userId` regardless of the
  // caller's granted PermissionScope: NOTIFICATION_READ is granted OWN to
  // every role precisely because "my notifications" is never a tenant- or
  // department-wide query, unlike every other OWN/DEPARTMENT/TENANT
  // resource in this system. There is deliberately no scope-restriction
  // parameter here.

  async list(
    tenantId: string,
    userId: string,
    query: { page: number; pageSize: number; unreadOnly?: boolean },
  ) {
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items,
      unreadCount,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async unreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { unreadCount: count };
  }

  /** Fetch-then-check, never a spread-in `where` — same discipline as every other OWN-scoped lookup. */
  async markRead(tenantId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.isRead) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
