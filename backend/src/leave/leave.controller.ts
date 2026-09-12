import {
  BadRequestException,
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
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get('types')
  @RequirePermissions(PERMISSIONS.LEAVE_READ)
  @ApiOperation({ summary: 'List leave types configured for the tenant' })
  listTypes(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.leaveService.listTypes(user.tenantId);
  }

  @Get('balances')
  @RequirePermissions(PERMISSIONS.LEAVE_READ)
  @ApiOperation({ summary: 'View leave balances (own balances, or another employee within scope)' })
  async listBalances(
    @Query('employeeId') employeeId: string | undefined,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    const targetEmployeeId = await this.leaveService.resolveBalanceTarget(
      user.tenantId,
      employeeId,
      user.employeeId,
      restriction,
    );
    return this.leaveService.listBalances(user.tenantId, targetEmployeeId);
  }

  @Get('requests')
  @RequirePermissions(PERMISSIONS.LEAVE_READ)
  @ApiOperation({ summary: 'List leave requests (scoped by role: tenant / department / self)' })
  async list(
    @Query() query: QueryLeaveRequestsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.leaveService.list(user.tenantId, query, restriction);
  }

  @Get('requests/:id')
  @RequirePermissions(PERMISSIONS.LEAVE_READ)
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.leaveService.getOne(user.tenantId, id, restriction);
  }

  @Post('requests')
  @RequirePermissions(PERMISSIONS.LEAVE_CREATE)
  @ApiOperation({ summary: 'Submit a leave request for yourself' })
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedPrincipal) {
    if (!user.employeeId) {
      throw new BadRequestException('This account is not linked to an employee record.');
    }
    return this.leaveService.create({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      dto,
      actorUserId: user.userId,
    });
  }

  @Patch('requests/:id/approve')
  @RequirePermissions(PERMISSIONS.LEAVE_APPROVE)
  @ApiOperation({ summary: 'Approve a pending leave request' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.leaveService.approve({
      tenantId: user.tenantId,
      id,
      actorUserId: user.userId,
      restriction,
      dto,
    });
  }

  @Patch('requests/:id/reject')
  @RequirePermissions(PERMISSIONS.LEAVE_REJECT)
  @ApiOperation({ summary: 'Reject a pending leave request' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.leaveService.reject({
      tenantId: user.tenantId,
      id,
      actorUserId: user.userId,
      restriction,
      dto,
    });
  }

  @Patch('requests/:id/cancel')
  @RequirePermissions(PERMISSIONS.LEAVE_CREATE)
  @ApiOperation({ summary: 'Cancel your own pending leave request' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    if (!user.employeeId) {
      throw new BadRequestException('This account is not linked to an employee record.');
    }
    return this.leaveService.cancel({
      tenantId: user.tenantId,
      id,
      employeeId: user.employeeId,
      actorUserId: user.userId,
    });
  }
}
