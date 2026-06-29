import { KnowledgeArticleCategory, KnowledgeArticleStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKnowledgeArticlesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(KnowledgeArticleCategory)
  category?: KnowledgeArticleCategory;

  @IsOptional()
  @IsEnum(KnowledgeArticleStatus)
  status?: KnowledgeArticleStatus;
}
