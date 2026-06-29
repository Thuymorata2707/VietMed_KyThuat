import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KnowledgeArticlesController } from './knowledge-articles.controller';
import { KnowledgeArticlesService } from './knowledge-articles.service';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeArticlesController],
  providers: [KnowledgeArticlesService],
})
export class KnowledgeArticlesModule {}
