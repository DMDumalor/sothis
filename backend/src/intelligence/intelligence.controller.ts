import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { IntelligenceService } from './intelligence.service';
import { QueryInsightsDto } from './dto/query-insights.dto';
import { ReviewInsightDto } from './dto/review-insight.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * Smart Intelligence & Risk Engine (spec sections 24 & 28). SMART_INSIGHT_READ
 * is TENANT for ADMIN/HR/FINANCE/DG and DEPARTMENT for DEPARTMENT_HEAD;
 * SMART_INSIGHT_REVIEW (close/dismiss an insight, or trigger detection on
 * demand) is only granted to ADMIN/HR/FINANCE — DG and Department Heads
 * are read-only here by design (an executive/dept head sees the signal,
 * the operational roles action it).
 */
@ApiTags('intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('intelligence')
export class IntelligenceController {
  constructor(
    private readonly intelligenceService: IntelligenceService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.SMART_INSIGHT_READ)
  @ApiOperation({
    summary:
      'Smart insight KPI summary (open/under-review counts by category and risk)',
  })
  summary(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.intelligenceService.summary(user.tenantId);
  }

  @Get('insights')
  @RequirePermissions(PERMISSIONS.SMART_INSIGHT_READ)
  @ApiOperation({ summary: 'List smart insights' })
  async list(
    @Query() query: QueryInsightsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(
      user,
      scope,
    );
    return this.intelligenceService.list(user.tenantId, query, restriction);
  }

  @Patch('insights/:id/review')
  @RequirePermissions(PERMISSIONS.SMART_INSIGHT_REVIEW)
  @ApiOperation({
    summary:
      'Record a human review decision on an insight (require human review before action)',
  })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewInsightDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.intelligenceService.review(
      user.tenantId,
      id,
      user.userId,
      dto.status,
      dto.reviewNote,
    );
  }

  @Post('evaluate')
  @RequirePermissions(PERMISSIONS.SMART_INSIGHT_REVIEW)
  @ApiOperation({
    summary:
      'Run every tenant-wide detector now (overtime spikes, lateness, leave surges, security)',
  })
  runDetectors(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.intelligenceService.runAllDetectors(user.tenantId);
  }
}
