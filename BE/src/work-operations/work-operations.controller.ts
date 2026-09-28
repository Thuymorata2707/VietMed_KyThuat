import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { SyncWorkOperationsDto } from './dto/sync-work-operations.dto';
import { WorkOperationsService } from './work-operations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-operations')
export class WorkOperationsController {
  constructor(private readonly service: WorkOperationsService) {}

  @Get('used-parts/summary')
  usedPartsSummary(
    @CurrentUser() user: RequestUser,
    @Query('engineerId') engineerId?: string,
    @Query('weekStart') weekStart?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.usedPartsSummary({
      user,
      engineerId,
      weekStart,
      from,
      to,
    });
  }

  @Get(':kind/:id')
  findForTask(
    @Param('kind') kind: 'repair' | 'maintenance' | 'installation',
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findForTask(kind, id, user);
  }

  @Put(':kind/:id')
  syncForTask(
    @Param('kind') kind: 'repair' | 'maintenance' | 'installation',
    @Param('id') id: string,
    @Body() dto: SyncWorkOperationsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.syncForTask(kind, id, dto, user);
  }
}
