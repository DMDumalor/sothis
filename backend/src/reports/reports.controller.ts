import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * Reports & analytics (spec section 27). Workforce/leave/attendance
 * reports are gated by REPORT_READ (TENANT for ADMIN/HR/FINANCE/DG,
 * DEPARTMENT for DEPARTMENT_HEAD) and resolved through ScopeService like
 * every other module. The payroll report is gated by PAYROLL_READ
 * instead — see ReportsService's class doc for why.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get('workforce')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({
    summary: 'Workforce headcount by department, status and employment type',
  })
  async workforce(
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(
      user,
      scope,
    );
    return this.reportsService.workforceSummary(user.tenantId, restriction);
  }

  @Get('leave')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({
    summary: 'Leave request volume, approvals and days taken by type',
  })
  async leave(
    @Query() query: QueryReportDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(
      user,
      scope,
    );
    return this.reportsService.leaveSummary(user.tenantId, query, restriction);
  }

  @Get('attendance')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({
    summary: 'Attendance status breakdown, punctuality and overtime',
  })
  async attendance(
    @Query() query: QueryReportDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(
      user,
      scope,
    );
    return this.reportsService.attendanceSummary(
      user.tenantId,
      query,
      restriction,
    );
  }

  @Get('payroll')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: 'Payroll cost trend by period (Finance/DG only)' })
  payroll(
    @Query() query: QueryReportDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.reportsService.payrollSummary(user.tenantId, query);
  }
}
