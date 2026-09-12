import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { QueryPayslipsDto } from './dto/query-payslips.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get('payroll/periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  listPeriods(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.listPeriods(user.tenantId);
  }

  @Post('payroll/periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_PROCESS)
  @ApiOperation({ summary: 'Create a new (DRAFT) payroll period' })
  createPeriod(@Body() dto: CreatePayrollPeriodDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.createPeriod({ tenantId: user.tenantId, dto, actorUserId: user.userId });
  }

  @Get('payroll/periods/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  getPeriod(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.getPeriod(user.tenantId, id);
  }

  @Post('payroll/periods/:id/process')
  @RequirePermissions(PERMISSIONS.PAYROLL_PROCESS)
  @ApiOperation({ summary: 'Calculate payroll for every active, compensated employee in this DRAFT period' })
  processPeriod(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.processPeriod({ tenantId: user.tenantId, periodId: id, actorUserId: user.userId });
  }

  @Get('payroll/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  getPayroll(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.getPayroll(user.tenantId, id);
  }

  @Patch('payroll/:id/review')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  review(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.review({ tenantId: user.tenantId, id, actorUserId: user.userId });
  }

  @Patch('payroll/:id/approve')
  @RequirePermissions(PERMISSIONS.PAYROLL_APPROVE)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.approve({ tenantId: user.tenantId, id, actorUserId: user.userId });
  }

  @Patch('payroll/:id/mark-paid')
  @RequirePermissions(PERMISSIONS.PAYROLL_APPROVE)
  @ApiOperation({ summary: 'Record payment for an approved payroll record' })
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.markPaid({ tenantId: user.tenantId, id, dto, actorUserId: user.userId });
  }

  @Get('payments')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  listPayments(@Query() query: QueryPaymentsDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.payrollService.listPayments(user.tenantId, query);
  }

  @Get('payslips')
  @RequirePermissions(PERMISSIONS.PAYSLIP_READ)
  async listPayslips(
    @Query() query: QueryPayslipsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.payrollService.listPayslips(user.tenantId, query, restriction?.onlyEmployeeId);
  }

  @Get('payslips/:id')
  @RequirePermissions(PERMISSIONS.PAYSLIP_READ)
  async getPayslip(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.payrollService.getPayslip(user.tenantId, id, restriction?.onlyEmployeeId);
  }
}
