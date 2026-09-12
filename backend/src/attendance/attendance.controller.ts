import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionScope } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { ClockActionDto } from './dto/clock-action.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly scopeService: ScopeService,
  ) {}

  @Post('clock-in')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CREATE)
  @ApiOperation({ summary: 'Clock in for yourself, or on behalf of an employee if the caller has tenant-wide access' })
  clockIn(@Body() dto: ClockActionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    if (!user.employeeId) {
      throw new BadRequestException('This account is not linked to an employee record.');
    }
    return this.attendanceService.clockIn({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      dto,
      actorUserId: user.userId,
    });
  }

  @Post('clock-out')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CREATE)
  @ApiOperation({ summary: 'Clock out for yourself' })
  clockOut(@Body() dto: ClockActionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    if (!user.employeeId) {
      throw new BadRequestException('This account is not linked to an employee record.');
    }
    return this.attendanceService.clockOut({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      dto,
      actorUserId: user.userId,
    });
  }

  @Get('records')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'List attendance records (scoped by role: tenant / department / self)' })
  async list(
    @Query() query: QueryAttendanceDto,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.attendanceService.list(user.tenantId, query, restriction);
  }

  @Get('records/:id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.attendanceService.getOne(user.tenantId, id, restriction);
  }

  @Patch('records/:id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_UPDATE)
  @ApiOperation({ summary: 'HR correction of an attendance record' })
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.attendanceService.correct({
      tenantId: user.tenantId,
      id,
      dto,
      actorUserId: user.userId,
    });
  }
}
