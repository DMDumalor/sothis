import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * HR/Admin-facing account provisioning endpoints (spec section 10). Kept
 * separate from AuthController because these routes require an
 * authenticated, permissioned actor (HR/Admin), unlike login/refresh/accept.
 */
@ApiTags('account-invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/employees/:employeeId/account-invitations')
export class AccountInvitationController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_INVITE)
  @ApiOperation({ summary: 'Invite an employee to activate their account' })
  async create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() actor: AuthenticatedPrincipal,
  ) {
    const [tenant, actorUser] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: actor.tenantId } }),
      this.prisma.user.findUnique({
        where: { id: actor.userId },
        include: { employee: true },
      }),
    ]);

    return this.authService.createInvitation({
      tenantId: actor.tenantId,
      employeeId,
      invitedById: actor.userId,
      emailOverride: dto.email,
      roleCode: dto.roleCode,
      organizationCode: tenant?.code ?? '',
      invitedByName: actorUser?.employee
        ? `${actorUser.employee.firstName} ${actorUser.employee.lastName}`
        : actor.email,
    });
  }

  @Post('revoke')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_INVITE)
  @ApiOperation({ summary: "Revoke an employee's pending invitation" })
  async revoke(
    @Param('employeeId') employeeId: string,
    @Body('invitationId') invitationId: string,
    @CurrentUser() actor: AuthenticatedPrincipal,
  ) {
    await this.authService.revokeInvitation({
      tenantId: actor.tenantId,
      invitationId,
      actorUserId: actor.userId,
    });
    return { success: true, employeeId };
  }
}
