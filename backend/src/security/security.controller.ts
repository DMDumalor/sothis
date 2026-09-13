import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QuerySecurityEventsDto } from './dto/query-security-events.dto';
import { ResolveSecurityEventDto } from './dto/resolve-security-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * Security & Audit Center (spec sections 14 & 40). SECURITY_READ and
 * AUDIT_READ are both TENANT-scoped, granted only to ADMIN and DG per
 * the role-permission matrix — every endpoint here is always scoped to
 * `user.tenantId` with no ScopeService/GrantedScope involvement, since
 * there is no narrower variant to resolve.
 */
@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  @ApiOperation({ summary: 'Security & audit center KPI summary' })
  summary(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.securityService.summary(user.tenantId);
  }

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'List tenant audit log entries' })
  listAuditLogs(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.securityService.listAuditLogs(user.tenantId, query);
  }

  @Get('events')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  @ApiOperation({ summary: 'List tenant security events' })
  listSecurityEvents(
    @Query() query: QuerySecurityEventsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.securityService.listSecurityEvents(user.tenantId, query);
  }

  @Patch('events/:id/resolve')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  @ApiOperation({ summary: 'Mark a security event as reviewed/resolved' })
  async resolveEvent(
    @Param('id') id: string,
    @Body() dto: ResolveSecurityEventDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    const event = await this.securityService.resolveSecurityEvent(
      user.tenantId,
      id,
      user.userId,
      dto.resolveNote,
    );
    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'security-event.resolved',
      resourceType: 'SecurityEvent',
      resourceId: id,
      metadata: dto.resolveNote ? { resolveNote: dto.resolveNote } : undefined,
    });
    return event;
  }
}
