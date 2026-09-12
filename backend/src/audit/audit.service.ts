import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  SecurityEventType,
  SecuritySeverity,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditParams {
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RecordSecurityEventParams {
  tenantId?: string | null;
  type: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
  ipAddress?: string | null;
}

/**
 * Append-only audit/security trail (spec section 14). Nothing in this
 * service exposes update or delete — audit records must not be casually
 * editable, and no controller should ever call anything but `record*`.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: params.actorUserId ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          metadata: params.metadata,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      // Auditing must never take down the primary request path, but a
      // failure here is itself operationally significant.
      this.logger.error(
        `Failed to write audit log for action "${params.action}": ${error}`,
      );
    }
  }

  async recordSecurityEvent(params: RecordSecurityEventParams) {
    try {
      await this.prisma.securityEvent.create({
        data: {
          tenantId: params.tenantId ?? null,
          type: params.type,
          severity: params.severity,
          description: params.description,
          metadata: params.metadata,
          userId: params.userId ?? null,
          ipAddress: params.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write security event "${params.type}": ${error}`,
      );
    }
  }
}
