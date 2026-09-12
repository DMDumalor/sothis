import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('overtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('overtime')
export class OvertimeController {
  constructor(
    private readonly overtimeService: OvertimeService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OVERTIME_READ)
  @ApiOperation({ summary: 'List overtime records (scoped by role: tenant / department / self)' })
  async list(
    @Query() query: QueryOvertimeDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.overtimeService.list(user.tenantId, query, restriction);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.OVERTIME_READ)
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.overtimeService.getOne(user.tenantId, id, restriction);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OVERTIME_CREATE)
  @ApiOperation({ summary: 'Submit an overtime record for yourself' })
  create(@Body() dto: CreateOvertimeDto, @CurrentUser() user: AuthenticatedPrincipal) {
    if (!user.employeeId) {
      throw new BadRequestException('This account is not linked to an employee record.');
    }
    return this.overtimeService.create({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      dto,
      actorUserId: user.userId,
    });
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.OVERTIME_APPROVE)
  @ApiOperation({ summary: 'Approve a pending overtime record' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.overtimeService.approve({ tenantId: user.tenantId, id, actorUserId: user.userId, restriction });
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.OVERTIME_REJECT)
  @ApiOperation({ summary: 'Reject a pending overtime record' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.overtimeService.reject({ tenantId: user.tenantId, id, actorUserId: user.userId, restriction });
  }
}
