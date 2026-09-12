import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.POSITION_READ)
  list(@Query('departmentId') departmentId: string | undefined, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.positionsService.list(user.tenantId, departmentId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.POSITION_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.positionsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.POSITION_CREATE)
  @ApiOperation({ summary: 'Create a position' })
  create(@Body() dto: CreatePositionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.positionsService.create({ tenantId: user.tenantId, dto, actorUserId: user.userId });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.POSITION_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdatePositionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.positionsService.update({ tenantId: user.tenantId, id, dto, actorUserId: user.userId });
  }
}
