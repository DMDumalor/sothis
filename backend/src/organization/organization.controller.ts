import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({ summary: 'Get organization profile and workforce stats' })
  getProfile(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.organizationService.getProfile(user.tenantId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({
    summary: 'Update organization profile (name, timezone, logo)',
  })
  updateProfile(
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.organizationService.updateProfile({
      tenantId: user.tenantId,
      dto,
      actorUserId: user.userId,
    });
  }
}
