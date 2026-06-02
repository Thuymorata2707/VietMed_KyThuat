import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { AttachmentsService } from './attachments.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadRoot = join(process.cwd(), 'uploads');
          mkdirSync(uploadRoot, { recursive: true });
          callback(null, uploadRoot);
        },
        filename: (_req, file, callback) => {
          const extension = file.originalname.split('.').pop();
          const random = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${random}.${extension}`);
        },
      }),
    }),
  )
  upload(
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attachmentsService.create(dto, file, user);
  }

  @Get()
  findAll(@Query() query: ListAttachmentsQueryDto) {
    return this.attachmentsService.findAll(query);
  }

  @Get('types')
  getTypes() {
    return this.attachmentsService.getTypes();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attachmentsService.findOne(id);
  }

  @Get(':storedName/file')
  async download(
    @Param('storedName') storedName: string,
    @Res() res: Response,
  ) {
    const attachment =
      await this.attachmentsService.findFileByStoredName(storedName);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    );

    return res.sendFile(attachment.path);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.remove(id, user);
  }
}
