import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.notificationsService.findForUser(user.id, Number(limit) || 10);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
