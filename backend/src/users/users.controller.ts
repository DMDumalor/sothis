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
import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { BulkInviteUsersDto } from './dto/bulk-invite-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin platform console: user account management, invitations and
 * role assignment. Distinct from AccountInvitationController (which is
 * HR's per-employee invite flow) — this is the tenant-wide admin view
 * over every User row, gated on USER_-prefixed permissions and
 * ROLE_MANAGE rather than EMPLOYEE_INVITE.
 */
@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  private async invitationContext(actor: AuthenticatedPrincipal) {
    const [tenant, actorUser] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: actor.tenantId } }),
      this.prisma.user.findUnique({
        where: { id: actor.userId },
        include: { employee: true },
      }),
    ]);
    return {
      organizationCode: tenant?.code ?? '',
      actorEmployeeName: actorUser?.employee
        ? `${actorUser.employee.firstName} ${actorUser.employee.lastName}`
        : null,
    };
  }

  @Get('employees-without-account')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({
    summary: 'List employees eligible to be invited (no account yet)',
  })
  listEmployeesWithoutAccount(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.usersService.listEmployeesWithoutAccount(user.tenantId);
  }

  @Get('invitations')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List account invitations for this organization' })
  listInvitations(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.usersService.listInvitations(user.tenantId);
  }

  @Post('invitations')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Invite a user account for an existing employee' })
  async inviteUser(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    const context = await this.invitationContext(user);
    return this.usersService.inviteUser({
      tenantId: user.tenantId,
      dto,
      actorUserId: user.userId,
      actorEmail: user.email,
      ...context,
    });
  }

  @Post('invitations/:invitationId/revoke')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.revokeInvitation({
      tenantId: user.tenantId,
      invitationId,
      actorUserId: user.userId,
    });
  }

  @Post('invitations/bulk')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({
    summary: 'Invite multiple employees at once (e.g. from a CSV import)',
  })
  async bulkInviteUsers(
    @Body() dto: BulkInviteUsersDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    const context = await this.invitationContext(user);
    return this.usersService.bulkInviteUsers({
      tenantId: user.tenantId,
      dto,
      actorUserId: user.userId,
      actorEmail: user.email,
      ...context,
    });
  }

  @Post('invitations/:invitationId/resend')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Revoke and re-issue a pending invitation' })
  async resendInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    const context = await this.invitationContext(user);
    return this.usersService.resendInvitation({
      tenantId: user.tenantId,
      invitationId,
      actorUserId: user.userId,
      actorEmail: user.email,
      ...context,
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List user accounts for this organization' })
  list(
    @Query() query: QueryUsersDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.list(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get a single user account' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USER_DISABLE)
  @ApiOperation({ summary: 'Enable or disable a user account' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.updateStatus({
      tenantId: user.tenantId,
      id,
      status: dto.status,
      actorUserId: user.userId,
    });
  }

  @Post(':id/unlock')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Clear a lockout and restore account access' })
  unlock(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.usersService.unlock({
      tenantId: user.tenantId,
      id,
      actorUserId: user.userId,
    });
  }

  @Patch(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({ summary: "Replace a user's role assignment" })
  updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.updateRoles({
      tenantId: user.tenantId,
      id,
      dto,
      actorUserId: user.userId,
    });
  }

  @Get(':id/sessions')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({
    summary: "List a user's active (non-revoked, non-expired) sessions",
  })
  listSessions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.listSessions(user.tenantId, id);
  }

  @Post(':id/sessions/revoke-all')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({
    summary: 'Sign this user out everywhere by revoking every active session',
  })
  revokeAllSessions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.revokeAllSessions({
      tenantId: user.tenantId,
      userId: id,
      actorUserId: user.userId,
    });
  }

  @Post(':id/sessions/:sessionId/revoke')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Revoke a single session' })
  revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.revokeSession({
      tenantId: user.tenantId,
      userId: id,
      sessionId,
      actorUserId: user.userId,
    });
  }

  @Get(':id/activity')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({
    summary: 'Recent login attempts and audit-trail entries for a user',
  })
  getActivity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.usersService.getActivity(user.tenantId, id);
  }
}
