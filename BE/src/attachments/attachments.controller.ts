import {
  BadRequestException,
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
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { AttachmentsService } from './attachments.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

const ALLOWED_UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

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
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_UPLOAD_EXTENSIONS[file.mimetype]) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, WEBP and PDF files are allowed',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  upload(
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    const extension = ALLOWED_UPLOAD_EXTENSIONS[file?.mimetype];
    if (file && extension) {
      file.filename = `${Date.now()}-${randomUUID()}.${extension}`;
    }

    return this.attachmentsService.create(dto, file, user);
  }

  @Get()
  findAll(
    @Query() query: ListAttachmentsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attachmentsService.findAll(query, user);
  }

  @Get('types')
  getTypes() {
    return this.attachmentsService.getTypes();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.findOne(id, user);
  }

  @Get(':storedName/file')
  async download(
    @Param('storedName') storedName: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsService.findFileByStoredName(
      storedName,
      user,
    );

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    );

    if (attachment.fileData) {
      return res.end(Buffer.from(attachment.fileData));
    }

    return res.sendFile(attachment.path);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.remove(id, user);
  }
}
