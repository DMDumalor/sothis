import { Injectable, Logger } from '@nestjs/common';
import { NotificationCategory, NotificationSeverity, Prisma } from '@prisma/client';
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
      this.logger.error(`Failed to create notification for user ${params.userId}: ${error}`);
    }
  }
}
