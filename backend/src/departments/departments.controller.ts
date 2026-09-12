import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: 'List departments (Department Heads see only their own)' })
  async list(@CurrentUser() user: AuthenticatedPrincipal, @GrantedScope() scope?: PermissionScope) {
    const restrictTo = scope === PermissionScope.DEPARTMENT
      ? await this.scopeService.getOwnDepartmentId(user.employeeId)
      : undefined;
    return this.departmentsService.list(user.tenantId, restrictTo ?? undefined);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restrictTo = scope === PermissionScope.DEPARTMENT
      ? await this.scopeService.getOwnDepartmentId(user.employeeId)
      : undefined;
    return this.departmentsService.findOne(user.tenantId, id, restrictTo ?? undefined);
  }

  @Get(':id/employees')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: 'List employees belonging to a department' })
  async listEmployees(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restrictTo = scope === PermissionScope.DEPARTMENT
      ? await this.scopeService.getOwnDepartmentId(user.employeeId)
      : undefined;
    return this.departmentsService.listEmployees(user.tenantId, id, restrictTo ?? undefined);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_CREATE)
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.departmentsService.create({ tenantId: user.tenantId, dto, actorUserId: user.userId });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({ summary: 'Update a department' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.departmentsService.update({ tenantId: user.tenantId, id, dto, actorUserId: user.userId });
  }
}
