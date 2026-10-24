import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString } from 'class-validator';
import { Body } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { DataImportsService } from './data-imports.service';

class CommitImportDto {
  @IsString()
  batchId!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('data-imports')
export class DataImportsController {
  constructor(private readonly dataImportsService: DataImportsService) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(new BadRequestException('Chỉ hỗ trợ tệp Excel .xlsx'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  preview(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp .xlsx');
    return this.dataImportsService.preview(file, user);
  }

  @Get(':batchId')
  getBatch(@Param('batchId') batchId: string) {
    return this.dataImportsService.getBatch(batchId);
  }

  @Post('commit')
  commit(@Body() dto: CommitImportDto, @CurrentUser() user: RequestUser) {
    return this.dataImportsService.commit(dto.batchId, user);
  }
}
