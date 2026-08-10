import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { DemoLoansService } from './demo-loans.service';
import { CompleteDemoLoanDto } from './dto/complete-demo-loan.dto';
import { CreateDemoLoanDto } from './dto/create-demo-loan.dto';
import { ListDemoLoansQueryDto } from './dto/list-demo-loans-query.dto';
import { UpdateDemoLoanDto } from './dto/update-demo-loan.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('demo-loans')
export class DemoLoansController {
  constructor(private readonly service: DemoLoansService) {}

  @Get()
  findAll(@Query() query: ListDemoLoansQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.findAll(query, user);
  }

  @Get('statuses')
  getStatuses() {
    return this.service.getStatuses();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDemoLoanDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDemoLoanDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/handover')
  handOver(@Param('id') id: string, @Body() dto: CompleteDemoLoanDto, @CurrentUser() user: RequestUser) {
    return this.service.handOver(id, dto, user);
  }

  @Post(':id/return')
  returnLoan(@Param('id') id: string, @Body() dto: CompleteDemoLoanDto, @CurrentUser() user: RequestUser) {
    return this.service.returnLoan(id, dto, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
