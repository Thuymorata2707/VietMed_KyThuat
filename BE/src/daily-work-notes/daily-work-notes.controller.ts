import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { DailyWorkNotesService } from './daily-work-notes.service';
import { CreateDailyWorkNoteDto } from './dto/create-daily-work-note.dto';
import { ListDailyWorkNotesQueryDto } from './dto/list-daily-work-notes-query.dto';
import { UpdateDailyWorkNoteDto } from './dto/update-daily-work-note.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('daily-work-notes')
export class DailyWorkNotesController {
  constructor(private readonly dailyWorkNotesService: DailyWorkNotesService) {}

  @Get()
  findAll(
    @Query() query: ListDailyWorkNotesQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dailyWorkNotesService.findAll(query, user);
  }

  @Post()
  create(@Body() dto: CreateDailyWorkNoteDto, @CurrentUser() user: RequestUser) {
    return this.dailyWorkNotesService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyWorkNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dailyWorkNotesService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.dailyWorkNotesService.remove(id, user);
  }
}
