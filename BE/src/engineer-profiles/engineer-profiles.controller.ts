import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertEngineerProfileDto } from './dto/upsert-engineer-profile.dto';
import { EngineerProfilesService } from './engineer-profiles.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('engineer-profiles')
export class EngineerProfilesController {
  constructor(
    private readonly engineerProfilesService: EngineerProfilesService,
  ) {}

  @Get()
  findAll() {
    return this.engineerProfilesService.findAll();
  }

  @Get(':userId')
  findByUserId(@Param('userId') userId: string) {
    return this.engineerProfilesService.findByUserId(userId);
  }

  @Roles('admin')
  @Put(':userId')
  upsert(
    @Param('userId') userId: string,
    @Body() dto: UpsertEngineerProfileDto,
  ) {
    return this.engineerProfilesService.upsert(userId, dto);
  }

  @Roles('admin')
  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.engineerProfilesService.remove(userId);
  }
}
