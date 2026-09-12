import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompensationService } from './compensation.service';
import { CreateCompensationDto } from './dto/create-compensation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

@ApiTags('compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compensation')
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  @Get('salary-structures')
  @RequirePermissions(PERMISSIONS.COMPENSATION_MANAGE)
  listSalaryStructures(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.compensationService.listSalaryStructures(user.tenantId);
  }

  @Get('employees/:employeeId')
  @RequirePermissions(PERMISSIONS.COMPENSATION_MANAGE)
  @ApiOperation({ summary: "An employee's compensation history, most recent first" })
  listForEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.compensationService.listForEmployee(user.tenantId, employeeId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMPENSATION_MANAGE)
  @ApiOperation({ summary: 'Record a new salary for an employee (closes out any currently-open record)' })
  create(@Body() dto: CreateCompensationDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.compensationService.create({ tenantId: user.tenantId, dto, actorUserId: user.userId });
  }
}
