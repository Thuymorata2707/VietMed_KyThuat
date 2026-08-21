import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { DeviceServiceTicketsService } from './device-service-tickets.service';
import { CreateDeviceServiceTicketDto } from './dto/create-device-service-ticket.dto';
import { ListDeviceServiceTicketsQueryDto } from './dto/list-device-service-tickets-query.dto';
import { ReturnDeviceServiceTicketDto } from './dto/return-device-service-ticket.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('device-service-tickets')
export class DeviceServiceTicketsController {
  constructor(private readonly service: DeviceServiceTicketsService) {}

  @Get()
  findAll(
    @Query() query: ListDeviceServiceTicketsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get('statuses')
  getStatuses() {
    return this.service.getStatuses();
  }

  @Get('next-code')
  async nextCode(@Query('date') date?: string) {
    return { code: await this.service.previewReceiveCode(date) };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user);
  }

  @Roles('admin', 'engineer')
  @Post()
  create(@Body() dto: CreateDeviceServiceTicketDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Roles('admin', 'engineer')
  @Post(':id/return')
  returnDevice(
    @Param('id') id: string,
    @Body() dto: ReturnDeviceServiceTicketDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.returnDevice(id, dto, user);
  }
}
