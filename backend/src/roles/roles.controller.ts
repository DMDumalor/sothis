import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS, PermissionCode } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE, PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({
    summary:
      'List the fixed roles for this organization with their granted permissions',
  })
  list(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.rolesService.listRoles(user.tenantId);
  }

  @Get('permission-catalog')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE, PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'List every permission code the platform defines' })
  permissionCatalog() {
    return this.rolesService.listPermissionCatalog();
  }

  @Patch(':roleId/permissions/:permissionCode')
  @RequirePermissions(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({
    summary: 'Grant or revoke a single permission (and scope) on a role',
  })
  updatePermission(
    @Param('roleId') roleId: string,
    @Param('permissionCode') permissionCode: string,
    @Body() dto: UpdateRolePermissionDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.rolesService.updateRolePermission({
      tenantId: user.tenantId,
      roleId,
      permissionCode: permissionCode as PermissionCode,
      dto,
      actorUserId: user.userId,
    });
  }

  @Post(':roleId/reset')
  @RequirePermissions(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({
    summary: "Reset a role's permissions back to the platform default set",
  })
  reset(
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.rolesService.resetRoleToDefault({
      tenantId: user.tenantId,
      roleId,
      actorUserId: user.userId,
    });
  }
}
