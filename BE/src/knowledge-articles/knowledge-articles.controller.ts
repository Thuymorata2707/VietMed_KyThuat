import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../common/request-user.type';
import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { ListKnowledgeArticlesQueryDto } from './dto/list-knowledge-articles-query.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';
import { KnowledgeArticlesService } from './knowledge-articles.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-articles')
export class KnowledgeArticlesController {
  constructor(private readonly service: KnowledgeArticlesService) {}

  @Get()
  findAll(@Query() query: ListKnowledgeArticlesQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateKnowledgeArticleDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeArticleDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
