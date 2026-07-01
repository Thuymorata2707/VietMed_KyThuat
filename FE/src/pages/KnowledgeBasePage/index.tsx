import { AlertTriangle, BookOpenCheck, Boxes, ClipboardCheck, Clock3, FileText, Loader2, PackageCheck, Pencil, Plus, Search, ShieldCheck, Trash2, Wrench, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { getRoleName } from '../../auth/roles';
import { PageFrame } from '../../components/PageFrame';
import { queryKeys } from '../../lib/queryKeys';

type KnowledgeArticleCategory = 'COMMON_FAULT' | 'PACKING' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'SAFETY' | 'OTHER';
type KnowledgeArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type CategoryFilter = KnowledgeArticleCategory | 'ALL';

type KnowledgeArticle = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  modelHint?: string | null;
  ownerTeam?: string | null;
  category: KnowledgeArticleCategory;
  status: KnowledgeArticleStatus;
  tags: string[];
  symptoms: string[];
  steps: string[];
  checklist: string[];
  note?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  updatedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
};

type ArticleForm = {
  title: string;
  summary: string;
  content: string;
  modelHint: string;
  ownerTeam: string;
  category: KnowledgeArticleCategory;
  status: KnowledgeArticleStatus;
  tagsText: string;
  symptomsText: string;
  stepsText: string;
  checklistText: string;
  note: string;
  sortOrder: string;
};

type ArticlePayload = {
  title: string;
  summary: string | null;
  content: string | null;
  modelHint: string | null;
  ownerTeam: string | null;
  category: KnowledgeArticleCategory;
  status: KnowledgeArticleStatus;
  tags: string[];
  symptoms: string[];
  steps: string[];
  checklist: string[];
  note: string | null;
  sortOrder: number;
};

const categoryMeta: Record<KnowledgeArticleCategory, { label: string; shortLabel: string; icon: ReactNode; tone: string }> = {
  COMMON_FAULT: {
    label: 'Lỗi thường gặp',
    shortLabel: 'Lỗi',
    icon: <AlertTriangle size={18} />,
    tone: 'bg-[#fff1f3] text-[#b5121b] border-[#fecdd3]',
  },
  PACKING: {
    label: 'Quy trình đóng hàng',
    shortLabel: 'Đóng hàng',
    icon: <Boxes size={18} />,
    tone: 'bg-[#f4f4f5] text-[#155e8a] border-[#cfe7f7]',
  },
  REPAIR: {
    label: 'Quy trình sửa chữa',
    shortLabel: 'Sửa chữa',
    icon: <Wrench size={18} />,
    tone: 'bg-[#fff9ed] text-[#9a5b00] border-[#f4ddb5]',
  },
  INSTALLATION: {
    label: 'Quy trình lắp đặt',
    shortLabel: 'Lắp đặt',
    icon: <PackageCheck size={18} />,
    tone: 'bg-[#f3fbf6] text-[#197044] border-[#ccebd8]',
  },
  MAINTENANCE: {
    label: 'Bảo trì định kỳ',
    shortLabel: 'Bảo trì',
    icon: <ClipboardCheck size={18} />,
    tone: 'bg-[#f8f6ff] text-[#5840a6] border-[#ddd5ff]',
  },
  SAFETY: {
    label: 'An toàn & bàn giao',
    shortLabel: 'An toàn',
    icon: <ShieldCheck size={18} />,
    tone: 'bg-[#f7f7f7] text-[#444444] border-[#dddddd]',
  },
  OTHER: {
    label: 'Kinh nghiệm khác',
    shortLabel: 'Khác',
    icon: <BookOpenCheck size={18} />,
    tone: 'bg-[#f7f7f7] text-[#444444] border-[#dddddd]',
  },
};

const categoryOptions = Object.keys(categoryMeta) as KnowledgeArticleCategory[];
const statusOptions: KnowledgeArticleStatus[] = ['PUBLISHED', 'DRAFT', 'ARCHIVED'];

const emptyForm: ArticleForm = {
  title: '',
  summary: '',
  content: '',
  modelHint: '',
  ownerTeam: '',
  category: 'COMMON_FAULT',
  status: 'DRAFT',
  tagsText: '',
  symptomsText: '',
  stepsText: '',
  checklistText: '',
  note: '',
  sortOrder: '0',
};

export function KnowledgeBasePage({ user }: { user: ApiUser }) {
  const role = getRoleName(user);
  const canApprove = role === 'admin';
  const canContribute = role === 'admin' || role === 'manager' || role === 'engineer';
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [formError, setFormError] = useState('');
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ArticleForm>(emptyForm);

  const articleParams = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    const trimmedQuery = deferredQuery.trim();
    if (trimmedQuery) params.set('search', trimmedQuery);
    if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
    return params.toString();
  }, [deferredQuery, selectedCategory]);

  const articlesQuery = useQuery({
    queryKey: queryKeys.knowledge.articles(articleParams),
    queryFn: async () => {
      const result = await apiFetch<Paginated<KnowledgeArticle>>(`/knowledge-articles?${articleParams}`);
      return result.data;
    },
  });

  const articles = articlesQuery.data ?? [];
  const loading = articlesQuery.isLoading || articlesQuery.isFetching;

  useEffect(() => {
    setSelectedArticleId((current) => (articles.some((article) => article.id === current) ? current : articles[0]?.id ?? ''));
  }, [articles]);

  const saveArticleMutation = useMutation({
    mutationFn: async ({ articleId, payload }: { articleId?: string; payload: ArticlePayload }) => {
      return articleId
        ? apiFetch<KnowledgeArticle>(`/knowledge-articles/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch<KnowledgeArticle>('/knowledge-articles', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async (saved) => {
      setIsFormOpen(false);
      setEditingArticle(null);
      setSelectedArticleId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'articles'] });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (articleId: string) => apiFetch(`/knowledge-articles/${articleId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'articles'] });
    },
  });

  const publishArticleMutation = useMutation({
    mutationFn: (articleId: string) => apiFetch<KnowledgeArticle>(`/knowledge-articles/${articleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    }),
    onSuccess: async (saved) => {
      setSelectedArticleId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'articles'] });
    },
  });

  const saving = saveArticleMutation.isPending || deleteArticleMutation.isPending || publishArticleMutation.isPending;
  const mutationError = saveArticleMutation.error ?? deleteArticleMutation.error ?? publishArticleMutation.error;
  const error = formError || (articlesQuery.error instanceof Error ? articlesQuery.error.message : '') || (mutationError instanceof Error ? mutationError.message : '');

  const categoryCounts = useMemo(() => {
    return categoryOptions.reduce<Record<KnowledgeArticleCategory, number>>((acc, category) => {
      acc[category] = articles.filter((article) => article.category === category).length;
      return acc;
    }, {} as Record<KnowledgeArticleCategory, number>);
  }, [articles]);

  const selectedArticle = articles.find((article) => article.id === selectedArticleId) ?? articles[0];
  const totalSteps = articles.reduce((total, article) => total + safeList(article.steps).length, 0);

  function openCreateForm() {
    setFormError('');
    setEditingArticle(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }

  function openEditForm(article: KnowledgeArticle) {
    setFormError('');
    setEditingArticle(article);
    setForm({
      title: article.title,
      summary: article.summary ?? '',
      content: article.content ?? '',
      modelHint: article.modelHint ?? '',
      ownerTeam: article.ownerTeam ?? '',
      category: article.category,
      status: article.status,
      tagsText: safeList(article.tags).join('\n'),
      symptomsText: safeList(article.symptoms).join('\n'),
      stepsText: safeList(article.steps).join('\n'),
      checklistText: safeList(article.checklist).join('\n'),
      note: article.note ?? '',
      sortOrder: String(article.sortOrder ?? 0),
    });
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const payload: ArticlePayload = {
      title: form.title,
      summary: form.summary || null,
      content: form.content || null,
      modelHint: form.modelHint || null,
      ownerTeam: form.ownerTeam || null,
      category: form.category,
      status: canApprove ? form.status : 'DRAFT',
      tags: linesToList(form.tagsText),
      symptoms: linesToList(form.symptomsText),
      steps: linesToList(form.stepsText),
      checklist: linesToList(form.checklistText),
      note: form.note || null,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      await saveArticleMutation.mutateAsync({ articleId: editingArticle?.id, payload });
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Không lưu được bài kinh nghiệm.');
    }
  }

  async function handleDelete(article: KnowledgeArticle) {
    if (!window.confirm(`Delete "${article.title}"?`)) return;
    setFormError('');
    try {
      await deleteArticleMutation.mutateAsync(article.id);
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Không xoá được bài kinh nghiệm.');
    }
  }

  async function handlePublish(article: KnowledgeArticle) {
    setFormError('');
    try {
      await publishArticleMutation.mutateAsync(article.id);
    } catch (publishError) {
      setFormError(publishError instanceof Error ? publishError.message : 'Không duyệt được bài kinh nghiệm.');
    }
  }

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[30px] border border-[#e4e4e7] bg-[#f4f4f5] p-6 shadow-[0_12px_30px_rgba(24,24,27,0.06)] lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(37,99,235,0.11),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(239,246,255,0.78))]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-semibold text-[#18181b]">
              <BookOpenCheck size={15} />
              Kinh nghiệm kỹ thuật
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1f1f1f] md:text-4xl">Sổ tay chia sẻ giữa các kỹ sư</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#555555]">
              Gom lỗi thường gặp, quy trình đóng hàng, sửa chữa, lắp đặt và bàn giao vào một nơi để đội kỹ thuật tra nhanh khi cần.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KnowledgeMetric label="Chủ đề" value={categoryOptions.length} />
            <KnowledgeMetric label="Bài viết" value={articles.length} />
            <KnowledgeMetric label="Bước xử lý" value={totalSteps} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4 rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_14px_36px_rgba(24,24,27,0.06)] lg:sticky lg:top-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d4d4d8] bg-[#fafafa] px-3 text-[#666666] focus-within:border-[#18181b] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]">
            <Search size={16} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1f1f1f] outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm lỗi, model, quy trình"
              value={query}
            />
          </label>

          {canContribute ? (
            <button className="primary-button justify-center" onClick={openCreateForm} type="button">
              <Plus size={16} />
              Add Article
            </button>
          ) : null}

          <div className="grid gap-2">
            <CategoryButton
              active={selectedCategory === 'ALL'}
              count={articles.length}
              icon={<BookOpenCheck size={18} />}
              label="Tất cả kinh nghiệm"
              onClick={() => setSelectedCategory('ALL')}
            />
            {categoryOptions.map((category) => (
              <CategoryButton
                active={selectedCategory === category}
                count={categoryCounts[category] ?? 0}
                icon={categoryMeta[category].icon}
                key={category}
                label={categoryMeta[category].label}
                onClick={() => setSelectedCategory(category)}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafafa] p-4 text-sm text-[#666666]">
            <strong className="block text-[#1f1f1f]">{canApprove ? 'Admin duyệt nội dung' : 'Đóng góp kinh nghiệm'}</strong>
            {canApprove ? 'Admin có thể duyệt Published hoặc đưa bài về Draft/Archived.' : 'Kỹ sư thêm/sửa bài của mình, admin duyệt thì bài mới hiển thị cho mọi người.'}
          </div>
        </aside>

        <div className="grid min-w-0 gap-5">
          {error ? <div className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] p-4 text-sm font-medium text-[#b5121b]">{error}</div> : null}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-[#d7e0eb] bg-[#fafafa] p-8 text-center text-sm font-semibold text-[#666666]">
              <Loader2 className="spin-icon mx-auto mb-2" size={20} />
              Đang tải sổ tay kinh nghiệm
            </div>
          ) : null}

          {!loading && articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d7e0eb] bg-[#fafafa] p-8 text-center text-sm text-[#666666]">
              Chưa có bài kinh nghiệm phù hợp. {canContribute ? 'Bấm Add Article để tạo bài đầu tiên.' : 'Vui lòng thử từ khóa khác.'}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                active={article.id === selectedArticle?.id}
                article={article}
                canApprove={canApprove}
                currentUserId={user.id}
                key={article.id}
                onDelete={() => handleDelete(article)}
                onEdit={() => openEditForm(article)}
                onPublish={() => handlePublish(article)}
                onSelect={() => setSelectedArticleId(article.id)}
              />
            ))}
          </div>

          {selectedArticle ? <ArticleDetail article={selectedArticle} /> : null}
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm">
          <form className="grid max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-[26px] border border-[#e4e4e7] bg-white shadow-[0_30px_90px_rgba(24,24,27,0.26)]" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4 border-b border-[#ededf0] p-5">
              <div>
                <h2 className="text-xl font-semibold text-[#1f1f1f]">{editingArticle ? 'Edit Article' : 'Add Article'}</h2>
                <p className="mt-1 text-sm text-[#666666]">Mỗi dòng trong Tags, dấu hiệu, quy trình và checklist sẽ thành một mục riêng.</p>
              </div>
              <button className="secondary-button compact" onClick={() => setIsFormOpen(false)} type="button">
                <X size={16} />
                Cancel
              </button>
            </div>

            <div className="grid max-h-[calc(92dvh-150px)] gap-4 overflow-y-auto p-5 md:grid-cols-2">
              <Field label="Tiêu đề">
                <input className="form-input" onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
              </Field>
              <Field label="Model / dòng máy">
                <input className="form-input" onChange={(event) => setForm({ ...form, modelHint: event.target.value })} value={form.modelHint} />
              </Field>
              <Field label="Nhóm phụ trách">
                <input className="form-input" onChange={(event) => setForm({ ...form, ownerTeam: event.target.value })} value={form.ownerTeam} />
              </Field>
              <Field label="Thứ tự">
                <input className="form-input" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} />
              </Field>
              <Field label="Chủ đề">
                <select className="form-input" onChange={(event) => setForm({ ...form, category: event.target.value as KnowledgeArticleCategory })} value={form.category}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{categoryMeta[category].label}</option>
                  ))}
                </select>
              </Field>
              {canApprove ? (
                <Field label="Trạng thái">
                  <select className="form-input" onChange={(event) => setForm({ ...form, status: event.target.value as KnowledgeArticleStatus })} value={form.status}>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{statusLabel(status)}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="rounded-2xl border border-[#f4ddb5] bg-[#fff9ed] p-4 text-sm text-[#805000]">
                  Bài của bạn sẽ ở trạng thái <strong>Chờ duyệt</strong>. Admin duyệt Published thì mọi kỹ sư mới nhìn thấy.
                </div>
              )}
              <Field className="md:col-span-2" label="Tóm tắt">
                <textarea className="form-input min-h-[76px]" onChange={(event) => setForm({ ...form, summary: event.target.value })} value={form.summary} />
              </Field>
              <Field label="Tags">
                <textarea className="form-input min-h-[110px]" onChange={(event) => setForm({ ...form, tagsText: event.target.value })} value={form.tagsText} />
              </Field>
              <Field label="Dấu hiệu nhận biết">
                <textarea className="form-input min-h-[110px]" onChange={(event) => setForm({ ...form, symptomsText: event.target.value })} value={form.symptomsText} />
              </Field>
              <Field label="Quy trình xử lý">
                <textarea className="form-input min-h-[170px]" onChange={(event) => setForm({ ...form, stepsText: event.target.value })} required value={form.stepsText} />
              </Field>
              <Field label="Checklist cần mang">
                <textarea className="form-input min-h-[170px]" onChange={(event) => setForm({ ...form, checklistText: event.target.value })} value={form.checklistText} />
              </Field>
              <Field className="md:col-span-2" label="Ghi chú">
                <textarea className="form-input min-h-[90px]" onChange={(event) => setForm({ ...form, note: event.target.value })} value={form.note} />
              </Field>
              <Field className="md:col-span-2" label="Nội dung dài thêm">
                <textarea className="form-input min-h-[120px]" onChange={(event) => setForm({ ...form, content: event.target.value })} value={form.content} />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ededf0] p-5">
              <button className="secondary-button" onClick={() => setIsFormOpen(false)} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={16} /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageFrame>
  );
}

function KnowledgeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_12px_28px_rgba(24,24,27,0.08)]">
      <span className="text-xs font-semibold text-[#777777]">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function CategoryButton({ active, count, icon, label, onClick }: { active: boolean; count: number; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition active:translate-y-px ${
        active ? 'border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b] shadow-[0_10px_24px_rgba(24,24,27,0.10)]' : 'border-[#eef1f5] bg-white text-[#444444] hover:border-[#e4e4e7] hover:text-[#18181b]'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="rounded-full bg-[#f4f5f7] px-2 py-0.5 text-xs text-[#666666]">{count}</span>
    </button>
  );
}

function ArticleCard({
  active,
  article,
  canApprove,
  currentUserId,
  onDelete,
  onEdit,
  onPublish,
  onSelect,
}: {
  active: boolean;
  article: KnowledgeArticle;
  canApprove: boolean;
  currentUserId: string;
  onDelete: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onSelect: () => void;
}) {
  const meta = categoryMeta[article.category];
  const canEditArticle = canApprove || article.createdBy?.id === currentUserId;
  return (
    <div className={`grid min-h-[230px] content-between rounded-2xl border bg-white p-4 shadow-[0_10px_28px_rgba(24,24,27,0.05)] transition hover:-translate-y-0.5 hover:border-[#e4e4e7] hover:shadow-[0_18px_42px_rgba(24,24,27,0.10)] ${active ? 'border-[#18181b] ring-4 ring-[#f4f4f5]' : 'border-[#e4e4e7]'}`}>
      <button className="text-left" onClick={onSelect} type="button">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
          {meta.icon}
          {meta.shortLabel}
        </span>
        <h2 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-[#1f1f1f]">{article.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#666666]">{article.summary}</p>
      </button>
      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {safeList(article.tags).slice(0, 3).map((tag) => (
            <span className="rounded-full bg-[#f5f6f8] px-2 py-1 text-[11px] font-medium text-[#666666]" key={tag}>{tag}</span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-[#777777]">
          <span className="truncate">{article.modelHint || article.ownerTeam || 'Tất cả model'}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock3 size={13} />
            {Math.max(3, safeList(article.steps).length)} phút
          </span>
        </div>
        {canEditArticle ? (
          <div className="flex items-center justify-between gap-2 border-t border-[#ededf0] pt-3">
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${article.status === 'PUBLISHED' ? 'bg-[#edf9f1] text-[#187044]' : article.status === 'DRAFT' ? 'bg-[#fff7e6] text-[#9a5b00]' : 'bg-[#f1f2f4] text-[#666666]'}`}>
              {statusLabel(article.status)}
            </span>
            <div className="flex gap-1.5">
              {canApprove && article.status === 'DRAFT' ? <button className="primary-button compact" onClick={onPublish} type="button">Publish</button> : null}
              <button className="secondary-button compact" onClick={onEdit} type="button"><Pencil size={14} />Edit</button>
              <button className="danger-button compact" onClick={onDelete} type="button"><Trash2 size={14} />Delete</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArticleDetail({ article }: { article: KnowledgeArticle }) {
  const meta = categoryMeta[article.category];
  return (
    <article className="overflow-hidden rounded-[26px] border border-[#e4e4e7] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.08)]">
      <div className="grid gap-4 border-b border-[#ededf0] bg-[#fafafa] p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1f1f1f]">{article.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666666]">{article.summary}</p>
        </div>
        <div className="grid content-start gap-2 rounded-2xl border border-[#e4e4e7] bg-white p-4 text-sm">
          <InfoLine label="Model" value={article.modelHint || 'Tất cả model'} />
          <InfoLine label="Nhóm" value={article.ownerTeam || '-'} />
          <InfoLine label="Cập nhật" value={formatDate(article.updatedAt)} />
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          {safeList(article.symptoms).length ? (
            <SectionBlock icon={<AlertTriangle size={18} />} title="Dấu hiệu nhận biết">
              <ul className="grid gap-2">
                {safeList(article.symptoms).map((symptom) => (
                  <li className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[#555555]" key={symptom}>{symptom}</li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}

          <SectionBlock icon={<FileText size={18} />} title="Quy trình xử lý">
            <ol className="grid gap-3">
              {safeList(article.steps).map((step, index) => (
                <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#ededf0] bg-white p-3" key={`${step}-${index}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#18181b] text-sm font-semibold text-white">{index + 1}</span>
                  <span className="self-center text-sm leading-6 text-[#444444]">{step}</span>
                </li>
              ))}
            </ol>
          </SectionBlock>

          {article.content ? (
            <SectionBlock icon={<BookOpenCheck size={18} />} title="Nội dung thêm">
              <p className="whitespace-pre-line text-sm leading-7 text-[#555555]">{article.content}</p>
            </SectionBlock>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <SectionBlock icon={<ClipboardCheck size={18} />} title="Checklist cần mang">
            <ul className="grid gap-2">
              {safeList(article.checklist).map((item) => (
                <li className="flex gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2 text-sm text-[#555555]" key={item}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#18181b]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SectionBlock>

          {article.note ? (
            <div className="rounded-2xl border border-[#e4e4e7] bg-[#f4f4f5] p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#18181b]">Lưu ý</span>
              <p className="mt-2 text-sm leading-6 text-[#555555]">{article.note}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function Field({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={`grid gap-1.5 text-sm font-semibold text-[#333333] ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionBlock({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-[#ededf0] bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
        <span className="text-[#18181b]">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-[#777777]">{label}</span>
      <strong className="mt-0.5 block text-sm font-semibold text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function linesToList(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function safeList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function statusLabel(status: KnowledgeArticleStatus) {
  if (status === 'PUBLISHED') return 'Published';
  if (status === 'DRAFT') return 'Chờ duyệt';
  return 'Archived';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
