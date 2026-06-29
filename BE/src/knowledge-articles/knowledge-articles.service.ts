import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeArticleCategory, KnowledgeArticleStatus, Prisma } from '@prisma/client';
import { isAdmin, isManager } from '../auth/access-scope';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { ListKnowledgeArticlesQueryDto } from './dto/list-knowledge-articles-query.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';

@Injectable()
export class KnowledgeArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListKnowledgeArticlesQueryDto, user: RequestUser): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const canManage = this.canManage(user);
    const where: Prisma.KnowledgeArticleWhereInput = {
      category: query.category,
      status: canManage ? query.status : KnowledgeArticleStatus.PUBLISHED,
      OR: search
        ? [
            { title: { contains: search } },
            { summary: { contains: search } },
            { modelHint: { contains: search } },
            { ownerTeam: { contains: search } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, user: RequestUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!article) throw new NotFoundException('Knowledge article not found');
    if (!this.canManage(user) && article.status !== KnowledgeArticleStatus.PUBLISHED) {
      throw new NotFoundException('Knowledge article not found');
    }
    return article;
  }

  async create(dto: CreateKnowledgeArticleDto, user: RequestUser) {
    this.assertCanManage(user);
    return this.prisma.knowledgeArticle.create({
      data: {
        title: this.cleanRequired(dto.title, 'title'),
        summary: this.cleanOptional(dto.summary),
        content: this.cleanOptional(dto.content),
        modelHint: this.cleanOptional(dto.modelHint),
        ownerTeam: this.cleanOptional(dto.ownerTeam),
        category: dto.category ?? KnowledgeArticleCategory.OTHER,
        status: dto.status ?? KnowledgeArticleStatus.PUBLISHED,
        tags: this.cleanStringArray(dto.tags),
        symptoms: this.cleanStringArray(dto.symptoms),
        steps: this.cleanStringArray(dto.steps),
        checklist: this.cleanStringArray(dto.checklist),
        note: this.cleanOptional(dto.note),
        sortOrder: dto.sortOrder ?? 0,
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.defaultInclude(),
    });
  }

  async update(id: string, dto: UpdateKnowledgeArticleDto, user: RequestUser) {
    this.assertCanManage(user);
    await this.findOne(id, user);
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        title: dto.title === undefined ? undefined : this.cleanRequired(dto.title, 'title'),
        summary: dto.summary === undefined ? undefined : this.cleanOptional(dto.summary),
        content: dto.content === undefined ? undefined : this.cleanOptional(dto.content),
        modelHint: dto.modelHint === undefined ? undefined : this.cleanOptional(dto.modelHint),
        ownerTeam: dto.ownerTeam === undefined ? undefined : this.cleanOptional(dto.ownerTeam),
        category: dto.category,
        status: dto.status,
        tags: dto.tags === undefined ? undefined : this.cleanStringArray(dto.tags),
        symptoms: dto.symptoms === undefined ? undefined : this.cleanStringArray(dto.symptoms),
        steps: dto.steps === undefined ? undefined : this.cleanStringArray(dto.steps),
        checklist: dto.checklist === undefined ? undefined : this.cleanStringArray(dto.checklist),
        note: dto.note === undefined ? undefined : this.cleanOptional(dto.note),
        sortOrder: dto.sortOrder,
        updatedById: user.id,
      },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string, user: RequestUser) {
    this.assertCanManage(user);
    await this.findOne(id, user);
    await this.prisma.knowledgeArticle.delete({ where: { id } });
    return { deleted: true };
  }

  private canManage(user: RequestUser) {
    return isAdmin(user) || isManager(user);
  }

  private assertCanManage(user: RequestUser) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('You do not have permission for this action');
    }
  }

  private cleanRequired(value: string, field: string) {
    const cleaned = value?.trim();
    if (!cleaned) throw new BadRequestException(`${field} is required`);
    return cleaned;
  }

  private cleanOptional(value?: string | null) {
    return value?.trim() || null;
  }

  private cleanStringArray(value?: string[]) {
    return (value ?? []).map((item) => item.trim()).filter(Boolean);
  }

  private defaultInclude() {
    return {
      createdBy: { select: { id: true, fullName: true, email: true } },
      updatedBy: { select: { id: true, fullName: true, email: true } },
    };
  }
}
