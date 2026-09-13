import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * NOTIFICATION_READ is granted OWN to every role in the matrix — there is
 * no DEPARTMENT/TENANT variant, so unlike every other module here this
 * controller never resolves a scope restriction: every query is always
 * hard-scoped to `user.userId`, never to anything wider.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  @ApiOperation({ summary: 'List your own in-app notifications' })
  list(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.notificationsService.list(user.tenantId, user.userId, query);
  }

  @Get('unread-count')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Unread notification count for the bell badge' })
  unreadCount(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.notificationsService.unreadCount(user.tenantId, user.userId);
  }

  @Patch(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.notificationsService.markRead(user.tenantId, user.userId, id);
  }

  @Post('read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  markAllRead(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.notificationsService.markAllRead(user.tenantId, user.userId);
  }
}
