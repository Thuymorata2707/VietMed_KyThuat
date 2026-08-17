import { ArrowLeft, ArrowRight, BarChart3, Boxes, ImageOff, Layers3, Loader2, PackagePlus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING' | 'PHYSIOTHERAPY' | 'ICU';

type ProductIndustry = {
  id: string;
  code: string;
  name: string;
  expertiseGroup: ExpertiseGroup;
  status?: string;
};

type BusinessLine = {
  id: string;
  code: string;
  name: string;
  imageUrl?: string | null;
  productCategory?: string | null;
  countryOfOrigin?: string | null;
  productIndustry?: ProductIndustry | null;
};

type MachineModel = {
  id: string;
  code: string;
  name: string;
  displayName?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  productLine?: string | null;
  productCategory?: string | null;
  businessLine?: BusinessLine | null;
};

type CatalogMachine = {
  id: string;
  machineModelId?: string | null;
  inventoryStatus?: string | null;
};

type ModelStock = {
  inStock: number;
  total: number;
};

type ProductCatalogOverview = {
  businessLines: BusinessLine[];
  industries: ProductIndustry[];
  models: MachineModel[];
  stockByModel: Record<string, ModelStock>;
};

type ModelFormState = {
  businessLineId: string;
  code: string;
  countryOfOrigin: string;
  displayName: string;
  manufacturer: string;
  name: string;
  note: string;
  productCategory: string;
  productLine: string;
};

const emptyModelForm: ModelFormState = {
  businessLineId: '',
  code: '',
  countryOfOrigin: '',
  displayName: '',
  manufacturer: '',
  name: '',
  note: '',
  productCategory: '',
  productLine: '',
};

const productCategoryOptions = [
  { label: 'Máy siêu âm', value: 'ULTRASOUND' },
  { label: 'Máy xét nghiệm', value: 'LAB_TESTING' },
  { label: 'Sinh hóa', value: 'BIOCHEMISTRY' },
  { label: 'Miễn dịch', value: 'IMMUNOLOGY' },
  { label: 'Huyết học', value: 'HEMATOLOGY' },
  { label: 'X-quang', value: 'X_RAY' },
  { label: 'Nội soi', value: 'ENDOSCOPY' },
  { label: 'Khác', value: 'OTHER' },
];

export function ProductCatalogPortalPage({ user }: { user: ApiUser }) {
  const catalogQuery = useCatalogOverview();
  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const industries = catalogQuery.data?.industries ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';

  const visibleIndustries = useMemo(() => {
    if (role !== 'engineer' || !userExpertise) return industries;
    return industries.filter((industry) => industry.expertiseGroup === userExpertise);
  }, [industries, role, userExpertise]);

  const visibleModels = useMemo(
    () => models.filter((model) => role !== 'engineer' || !userExpertise || model.businessLine?.productIndustry?.expertiseGroup === userExpertise),
    [models, role, userExpertise],
  );

  const stockByIndustry = useMemo(() => buildStockByIndustry(models, stockByModel), [models, stockByModel]);
  const industryCards = useMemo(() => buildIndustryCards(visibleIndustries, visibleModels, stockByIndustry), [stockByIndustry, visibleIndustries, visibleModels]);
  const totals = useMemo(() => {
    const productIds = new Set(visibleModels.map((model) => model.businessLine?.id).filter(Boolean));
    const machineTotals = industryCards.reduce(
      (total, item) => ({
        inStock: total.inStock + item.stock.inStock,
        total: total.total + item.stock.total,
      }),
      { inStock: 0, total: 0 },
    );

    return {
      businessLines: productIds.size,
      industries: visibleIndustries.length,
      inStock: machineTotals.inStock,
      machines: machineTotals.total,
      models: visibleModels.length,
    };
  }, [industryCards, visibleIndustries.length, visibleModels]);

  return (
    <PageFrame>
      <CatalogPortalHero canAddProduct={canAddProduct} loading={loading} onRefresh={() => void catalogQuery.refetch()} totals={totals} />
      {error ? <Notice message={error} /> : null}

      {loading ? <CatalogLoading label="Đang tải ngành hàng" /> : null}

      {!loading ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {industryCards.map((item) => (
            <IndustryPortalCard item={item} key={item.id} />
          ))}
        </section>
      ) : null}

      {!loading && industryCards.length === 0 ? <CatalogEmpty label="Chưa có ngành hàng phù hợp với tài khoản này." /> : null}
    </PageFrame>
  );
}

export function ProductIndustryModelsPage({ user }: { user: ApiUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { industryId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [modelForm, setModelForm] = useState<ModelFormState>(emptyModelForm);
  const [modelFormError, setModelFormError] = useState('');
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const catalogQuery = useCatalogOverview();
  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const canAddModel = role === 'admin';
  const industries = catalogQuery.data?.industries ?? [];
  const businessLines = catalogQuery.data?.businessLines ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';
  const industry = industries.find((item) => item.id === industryId) ?? null;
  const industryBusinessLines = useMemo(() => businessLines.filter((line) => line.productIndustry?.id === industryId), [businessLines, industryId]);

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return models.filter((model) => {
      const industry = model.businessLine?.productIndustry;
      const matchesIndustry = industry?.id === industryId;
      const matchesExpertise = role !== 'engineer' || !userExpertise || industry?.expertiseGroup === userExpertise;
      const matchesQuery =
        !normalizedQuery ||
        [model.code, model.name, model.displayName, model.manufacturer, model.productLine, model.businessLine?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesIndustry && matchesExpertise && matchesQuery;
    });
  }, [industryId, models, query, role, userExpertise]);

  const industryStock = useMemo(
    () =>
      visibleModels.reduce(
        (total, model) => {
          const stock = stockByModel[model.id] ?? { inStock: 0, total: 0 };
          return { inStock: total.inStock + stock.inStock, total: total.total + stock.total };
        },
        { inStock: 0, total: 0 },
      ),
    [stockByModel, visibleModels],
  );

  function updateSearch(nextQuery: string) {
    setQuery(nextQuery);
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set('q', nextQuery.trim());
    setSearchParams(next, { replace: true });
  }

  const catalogSearch = buildCatalogSearch(industryId, query);

  const createModelMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) =>
      apiFetch<MachineModel>('/machine-models', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setModelModalOpen(false);
      setModelForm(emptyModelForm);
      setModelFormError('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview });
    },
    onError: (mutationError) => {
      setModelFormError(mutationError instanceof Error ? mutationError.message : 'Không thể tạo model mới.');
    },
  });

  function openModelForm() {
    const firstLine = industryBusinessLines[0] ?? null;
    setModelForm({
      ...emptyModelForm,
      businessLineId: firstLine?.id ?? '',
      countryOfOrigin: firstLine?.countryOfOrigin ?? '',
      productCategory: firstLine?.productCategory ?? '',
      productLine: firstLine?.name ?? '',
    });
    setModelFormError('');
    setModelModalOpen(true);
  }

  function updateModelForm(field: keyof ModelFormState, value: string) {
    if (field === 'businessLineId') {
      const line = industryBusinessLines.find((item) => item.id === value) ?? null;
      setModelForm((current) => ({
        ...current,
        businessLineId: value,
        countryOfOrigin: current.countryOfOrigin || line?.countryOfOrigin || '',
        productCategory: current.productCategory || line?.productCategory || '',
        productLine: line?.name || current.productLine,
      }));
      return;
    }
    setModelForm((current) => ({ ...current, [field]: value }));
  }

  function submitModelForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = modelForm.code.trim().toUpperCase();
    const name = modelForm.name.trim();

    if (!modelForm.businessLineId) {
      setModelFormError('Vui lòng chọn dòng sản phẩm cho model.');
      return;
    }
    if (!code || !name) {
      setModelFormError('Vui lòng nhập model và tên sản phẩm.');
      return;
    }

    const payload = compactModelPayload({
      businessLineId: modelForm.businessLineId,
      code,
      countryOfOrigin: modelForm.countryOfOrigin.trim(),
      displayName: modelForm.displayName.trim(),
      manufacturer: modelForm.manufacturer.trim(),
      name,
      note: modelForm.note.trim(),
      productCategory: modelForm.productCategory,
      productLine: modelForm.productLine.trim(),
    });

    createModelMutation.mutate(payload);
  }

  function openModelDetail(modelId: string) {
    navigate(`/business-lines/models/${modelId}${catalogSearch}`);
  }

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#fafafa] p-5 shadow-[0_12px_30px_rgba(24,24,27,0.05)] md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(24,24,27,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(24,24,27,0.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#e4e4e7]/35 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button className="secondary-button mb-5" onClick={() => navigate('/product-catalog')} type="button">
              <ArrowLeft size={17} />
              Quay lại ngành hàng
            </button>
            <PageTitle
              description={`${visibleModels.length} model · ${industryStock.total} máy · ${industryStock.inStock} còn kho`}
              eyebrow="Model máy"
              title={industry?.name || 'Ngành hàng'}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link className="secondary-button bg-white" to={`/technical-machines${industryId ? `?productIndustryId=${industryId}` : ''}`}>
              <Boxes size={17} />
              Danh sách máy quản lý
            </Link>
            {canAddModel ? (
              <button className="secondary-button bg-white" onClick={openModelForm} type="button">
                <Plus size={17} />
                Thêm model
              </button>
            ) : null}
            {canAddProduct ? (
              <Link className="primary-button" to="/business-lines/add-product">
                <Plus size={17} />
                Thêm máy
              </Link>
            ) : null}
            <button className="secondary-button" disabled={loading} onClick={() => void catalogQuery.refetch()} type="button">
              {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
              Làm mới
            </button>
          </div>
        </div>

        <label className="relative mt-5 flex h-13 min-w-0 items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-white/88 px-4 text-[#666666] shadow-[0_14px_36px_rgba(24,24,27,0.08)] focus-within:border-[#18181b] focus-within:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]">
          <Search size={18} />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-[#1f1f1f] outline-none"
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Tìm model, hãng, dòng sản phẩm"
            value={query}
          />
        </label>
      </section>

      {error ? <Notice message={error} /> : null}
      {loading ? <CatalogLoading label="Đang tải model" /> : null}
      {!loading && visibleModels.length === 0 ? <CatalogEmpty label="Không có model phù hợp." /> : null}

      {!loading && visibleModels.length ? (
        <CatalogModelTable
          canAddProduct={canAddProduct}
          catalogSearch={catalogSearch}
          models={visibleModels}
          onOpenModel={openModelDetail}
          stockByModel={stockByModel}
        />
      ) : null}

      {modelModalOpen ? (
        <AddModelModal
          businessLines={industryBusinessLines}
          error={modelFormError}
          form={modelForm}
          loading={createModelMutation.isPending}
          onChange={updateModelForm}
          onClose={() => setModelModalOpen(false)}
          onSubmit={submitModelForm}
        />
      ) : null}
    </PageFrame>
  );
}

function useCatalogOverview() {
  return useQuery({
    queryKey: queryKeys.productCatalog.overview,
    queryFn: async (): Promise<ProductCatalogOverview> => {
      const [industryResult, businessLines, nextModels, machines] = await Promise.all([
        apiFetch<Paginated<ProductIndustry>>('/product-industries?limit=100'),
        apiFetch<BusinessLine[]>('/business-lines'),
        apiFetchAllPages<MachineModel>('/machine-models'),
        apiFetchAllPages<CatalogMachine>('/machines'),
      ]);

      return {
        businessLines,
        industries: industryResult.data ?? [],
        models: nextModels,
        stockByModel: buildStockByModel(nextModels, machines),
      };
    },
  });
}

function CatalogPortalHero({
  canAddProduct,
  loading,
  onRefresh,
  totals,
}: {
  canAddProduct: boolean;
  loading: boolean;
  onRefresh: () => void;
  totals: { businessLines: number; industries: number; inStock: number; machines: number; models: number };
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#f6f8f7] px-5 py-6 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] md:px-6">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_80%_20%,rgba(62,131,117,0.14),transparent_32%),radial-gradient(circle_at_100%_90%,rgba(180,83,9,0.08),transparent_34%)]" />
      <div className="relative grid gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_auto] min-[960px]:items-end">
        <div>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-white/82 px-3 text-xs font-semibold text-[#4b5563] shadow-[0_8px_22px_rgba(24,24,27,0.06)]">
            <span className="h-2 w-2 rounded-full bg-[#3e8375]" />
            Danh mục kỹ thuật
          </span>
          <h1 className="mt-4 text-[clamp(32px,4vw,56px)] font-semibold leading-[1.05] text-[#202124]">Sản phẩm & Thiết bị</h1>
          <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[#667085]">Ngành hàng, model và tồn kho.</p>
        </div>
        <div className="flex flex-wrap gap-2 min-[960px]:justify-end">
          <Link className="secondary-button bg-white/86" to="/technical-machines">
            <Boxes size={17} />
            Danh sách máy quản lý
          </Link>
          {canAddProduct ? (
            <Link className="primary-button" to="/business-lines/add-product">
              <Plus size={17} />
              Thêm máy
            </Link>
          ) : null}
          <button className="secondary-button bg-white/86" disabled={loading} onClick={onRefresh} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <Link to="/technical-machines" className="block cursor-pointer rounded-[20px] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(24,24,27,0.07)]">
          <MetricCard icon={<Boxes size={18} />} label="Tổng máy" subLabel={`${totals.inStock} còn kho`} value={totals.machines} />
        </Link>
        <MetricCard icon={<Layers3 size={18} />} label="Model" subLabel={`${totals.businessLines} nhóm sản phẩm`} value={totals.models} />
        <MetricCard icon={<BarChart3 size={18} />} label="Ngành hàng" subLabel="nhóm chính" value={totals.industries} />
      </div>
    </section>
  );
}

function IndustryPortalCard({ item }: { item: { id: string; name: string; expertise: string; modelCount: number; stock: ModelStock } }) {
  const ratio = item.stock.total ? Math.round((item.stock.inStock / item.stock.total) * 100) : 0;

  return (
    <Link
      className="group relative min-h-[156px] overflow-hidden rounded-[24px] bg-white/94 p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_8px_22px_rgba(24,24,27,0.045)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(62,131,117,0.22),0_16px_34px_rgba(24,24,27,0.08)]"
      to={`/product-catalog/industries/${item.id}`}
    >
      <div className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef6f4] text-[#2f6f63]">
          <Boxes size={20} />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-lg font-semibold text-[#202124]">{item.name}</strong>
          <span className="mt-1 block text-sm font-medium text-[#667085]">{item.expertise}</span>
        </span>
      </div>
      <div className="relative mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[#3f3f46]">{item.modelCount} model</span>
          <span className="rounded-full bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{item.stock.inStock}/{item.stock.total} còn kho</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e4e7ec]">
          <span className="block h-full rounded-full bg-[#3e8375]" style={{ width: `${Math.max(ratio, item.stock.total ? 8 : 0)}%` }} />
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f6f63]">
          Mở model <ArrowRight className="transition group-hover:translate-x-1" size={16} />
        </span>
      </div>
    </Link>
  );
}

function CatalogModelTable({
  canAddProduct,
  catalogSearch,
  models,
  onOpenModel,
  stockByModel,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  models: MachineModel[];
  onOpenModel: (modelId: string) => void;
  stockByModel: Record<string, ModelStock>;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(models.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedModels = models.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [catalogSearch, models.length]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_12px_30px_rgba(24,24,27,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] bg-[#fafafa] px-4 py-3">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#667985]">Danh sách model</span>
          <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[#1f1f1f]">Model theo ngành hàng</h2>
        </div>
        <span className="rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-black text-[#333333]">
          {models.length} model
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="bg-white text-xs font-black uppercase tracking-[0.08em] text-[#667985]">
            <tr className="border-b border-[#e4e4e7]">
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Tên sản phẩm</th>
              <th className="px-4 py-3">Dòng sản phẩm</th>
              <th className="px-4 py-3">Hãng</th>
              <th className="px-4 py-3">Xuất xứ</th>
              <th className="px-4 py-3">Kho</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedModels.map((model) => (
              <CatalogModelRow
                canAddProduct={canAddProduct}
                catalogSearch={catalogSearch}
                key={model.id}
                model={model}
                onOpen={onOpenModel}
                stock={stockByModel[model.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        disabled={false}
        label="model"
        page={currentPage}
        pageSize={pageSize}
        total={models.length}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

function TablePager({
  disabled,
  label,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  disabled: boolean;
  label: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#666666]">
      <span>{total ? `${first}-${last}/${total} ${label}` : `0 ${label}`}</span>
      <div className="flex items-center gap-2">
        <button className="secondary-button compact" disabled={disabled || page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">
          Trước
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button className="secondary-button compact" disabled={disabled || page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} type="button">
          Sau
        </button>
      </div>
    </div>
  );
}

function CatalogModelRow({
  canAddProduct,
  model,
  onOpen,
  stock,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  model: MachineModel;
  onOpen: (modelId: string) => void;
  stock?: ModelStock;
}) {
  const total = stock?.total ?? 0;
  const inStock = stock?.inStock ?? 0;

  return (
    <tr
      className="cursor-pointer border-b border-[#eeeeee] transition last:border-b-0 hover:bg-[#fafafa] focus-within:bg-[#fafafa]"
      onClick={() => onOpen(model.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(model.id);
        }
      }}
      tabIndex={0}
    >
      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ModelImage model={model} />
          <strong className="min-w-0 truncate text-base font-black text-[#1f1f1f]">{modelShortLabel(model)}</strong>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="block max-w-[360px] truncate text-sm font-semibold text-[#333333]">{modelProductName(model)}</span>
        <span className="mt-1 block max-w-[360px] truncate text-xs font-medium text-[#667985]">{modelDetailLabel(model)}</span>
      </td>
      <td className="px-4 py-4 text-sm">
        <span className="block font-semibold text-[#333333]">{model.businessLine?.name || 'Chưa có dòng'}</span>
        <span className="mt-1 block text-xs font-medium text-[#667985]">{productCategoryLabel(model.productCategory ?? model.businessLine?.productCategory)}</span>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-[#333333]">{model.manufacturer || 'Chưa có hãng'}</td>
      <td className="px-4 py-4 text-sm font-semibold text-[#333333]">{modelOrigin(model) || '-'}</td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{inStock}/{total} kho</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          {canAddProduct ? (
            <Link className="primary-button compact" onClick={(event) => event.stopPropagation()} to={`/business-lines/add-product?modelId=${model.id}`}>
              <PackagePlus size={15} />
              Thêm máy
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function AddModelModal({
  businessLines,
  error,
  form,
  loading,
  onChange,
  onClose,
  onSubmit,
}: {
  businessLines: BusinessLine[];
  error: string;
  form: ModelFormState;
  loading: boolean;
  onChange: (field: keyof ModelFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#18181b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[26px] border border-[#e4e4e7] bg-white p-5 shadow-[0_30px_90px_rgba(24,24,27,0.28)]" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-[#eeeeee] pb-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667985]">Danh mục model</span>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#1f1f1f]">Thêm model theo ngành hàng</h2>
            <p className="mt-1 text-sm font-semibold text-[#667985]">Model ghim vào dòng sản phẩm dùng chung.</p>
          </div>
          <button className="secondary-button compact bg-white" onClick={onClose} type="button" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        {businessLines.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafafa] p-5 text-sm font-semibold text-[#667985]">
            Chưa có nhóm sản phẩm.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ModelFormField label="Dòng sản phẩm">
              <select className="form-input" onChange={(event) => onChange('businessLineId', event.target.value)} value={form.businessLineId}>
                {businessLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </ModelFormField>
            <ModelFormField label="Model">
              <input className="form-input uppercase" onChange={(event) => onChange('code', event.target.value)} placeholder="VD: X-CUBE 50" value={form.code} />
            </ModelFormField>
            <ModelFormField label="Tên sản phẩm">
              <input className="form-input" onChange={(event) => onChange('name', event.target.value)} placeholder="VD: Máy siêu âm X-CUBE 50" value={form.name} />
            </ModelFormField>
            <ModelFormField label="Tên hiển thị">
              <input className="form-input" onChange={(event) => onChange('displayName', event.target.value)} placeholder="Không bắt buộc" value={form.displayName} />
            </ModelFormField>
            <ModelFormField label="Hãng sản xuất">
              <input className="form-input" onChange={(event) => onChange('manufacturer', event.target.value)} placeholder="Mindray, Sonoscape..." value={form.manufacturer} />
            </ModelFormField>
            <ModelFormField label="Xuất xứ">
              <input className="form-input" onChange={(event) => onChange('countryOfOrigin', event.target.value)} placeholder="China, Korea, Japan..." value={form.countryOfOrigin} />
            </ModelFormField>
            <ModelFormField label="Sản phẩm">
              <select className="form-input" onChange={(event) => onChange('productCategory', event.target.value)} value={form.productCategory}>
                <option value="">Chưa chọn</option>
                {productCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </ModelFormField>
            <ModelFormField label="Dòng/nhóm">
              <input className="form-input" onChange={(event) => onChange('productLine', event.target.value)} placeholder="VD: Máy siêu âm" value={form.productLine} />
            </ModelFormField>
            <label className="grid gap-2 text-sm font-bold text-[#333333] md:col-span-2">
              Ghi chú
              <textarea className="min-h-24 rounded-2xl border border-[#d8dee8] bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]" onChange={(event) => onChange('note', event.target.value)} placeholder="Quy cách đóng gói, kích thước..." value={form.note} />
            </label>
          </div>
        )}

        {error ? <Notice message={error} /> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#eeeeee] pt-4">
          <button className="secondary-button" onClick={onClose} type="button">
            Hủy
          </button>
          <button className="primary-button" disabled={loading || businessLines.length === 0} type="submit">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
            Lưu model
          </button>
        </div>
      </form>
    </div>
  );
}

function ModelFormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[#333333]">
      {label}
      {children}
    </label>
  );
}

function MetricCard({ icon, label, subLabel, value }: { icon: ReactNode; label: string; subLabel: string; value: number }) {
  return (
    <div className="grid gap-2 rounded-[20px] bg-white/88 p-3 text-left shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06),0_8px_20px_rgba(24,24,27,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#667085]">{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f6f8f7] text-[#2f6f63]">{icon}</span>
      </div>
      <strong className="text-2xl font-semibold leading-none text-[#202124]">{value}</strong>
      <span className="text-xs font-medium text-[#7a8699]">{subLabel}</span>
    </div>
  );
}

function CatalogLoading({ label }: { label: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#e4e4e7] bg-[#fafafa] p-8 text-center text-sm font-semibold text-[#666666]">
      <Loader2 className="spin-icon mx-auto mb-2" size={20} />
      {label}
    </div>
  );
}

function CatalogEmpty({ label }: { label: string }) {
  return <div className="rounded-[28px] border border-dashed border-[#e4e4e7] bg-[#fafafa] p-8 text-center text-sm text-[#666666]">{label}</div>;
}

function ModelImage({ model, large = false }: { model?: MachineModel | null; large?: boolean }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = model?.businessLine?.imageUrl;
  const sizeClass = large ? 'h-16 w-16' : 'h-12 w-12';

  if (!imageUrl || hasError) {
    return (
      <span className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl border border-[#e4e4e7] bg-[#f4f4f5] text-[#9f6b70]`}>
        <ImageOff size={large ? 24 : 18} />
      </span>
    );
  }

  return (
    <span className={`${sizeClass} block shrink-0 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white`}>
      <img alt={model?.name ?? ''} className="h-full w-full object-cover" onError={() => setHasError(true)} src={imageUrl} />
    </span>
  );
}

function buildStockByIndustry(models: MachineModel[], stockByModel: Record<string, ModelStock>) {
  const next: Record<string, ModelStock> = {};

  models.forEach((model) => {
    const industryId = model.businessLine?.productIndustry?.id;
    if (!industryId) return;
    const current = next[industryId] ?? { inStock: 0, total: 0 };
    const stock = stockByModel[model.id] ?? { inStock: 0, total: 0 };
    next[industryId] = {
      inStock: current.inStock + stock.inStock,
      total: current.total + stock.total,
    };
  });

  return next;
}

function buildIndustryCards(industries: ProductIndustry[], models: MachineModel[], stockByIndustry: Record<string, ModelStock>) {
  const modelCountByIndustry = models.reduce<Record<string, number>>((count, model) => {
    const industryId = model.businessLine?.productIndustry?.id;
    if (!industryId) return count;
    count[industryId] = (count[industryId] ?? 0) + 1;
    return count;
  }, {});

  return industries
    .map((industry) => ({
      id: industry.id,
      name: industry.name,
      expertise: expertiseLabel(industry.expertiseGroup),
      modelCount: modelCountByIndustry[industry.id] ?? 0,
      stock: stockByIndustry[industry.id] ?? { inStock: 0, total: 0 },
    }))
    .sort((first, second) => second.stock.total - first.stock.total || second.modelCount - first.modelCount || first.name.localeCompare(second.name, 'vi'));
}

function buildStockByModel(models: MachineModel[], machines: CatalogMachine[]) {
  const allowedModelIds = new Set(models.map((model) => model.id));
  const stockByModel = models.reduce<Record<string, ModelStock>>((stock, model) => {
    stock[model.id] = { inStock: 0, total: 0 };
    return stock;
  }, {});

  machines.forEach((machine) => {
    if (!machine.machineModelId || !allowedModelIds.has(machine.machineModelId)) return;
    const current = stockByModel[machine.machineModelId] ?? { inStock: 0, total: 0 };
    current.total += 1;
    if (machine.inventoryStatus === 'IN_STOCK') current.inStock += 1;
    stockByModel[machine.machineModelId] = current;
  });

  return stockByModel;
}

function expertiseLabel(value?: ExpertiseGroup | null) {
  if (value === 'LAB_TESTING') return 'Xét nghiệm';
  if (value === 'IMAGING') return 'Chẩn đoán hình ảnh';
  if (value === 'PHYSIOTHERAPY') return 'VLTL';
  if (value === 'ICU') return 'ICU';
  return 'Chưa phân nhóm';
}

function modelShortLabel(model: MachineModel) {
  return model.code || model.displayName || model.name;
}

function modelDetailLabel(model: MachineModel) {
  return [model.name, model.productLine, modelOrigin(model), model.businessLine?.name].filter(Boolean).join(' - ') || 'Chưa có mô tả model';
}

function modelProductName(model: MachineModel) {
  const baseName = model.name || model.displayName || model.code;
  const modelName = modelShortLabel(model);
  return baseName?.toLowerCase().includes(modelName.toLowerCase()) ? baseName : `${baseName} ${modelName}`.trim();
}

function modelOrigin(model: MachineModel) {
  return model.countryOfOrigin || model.businessLine?.countryOfOrigin || '';
}

function productCategoryLabel(value?: string | null) {
  if (!value) return 'Chưa phân loại';
  return productCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function buildCatalogSearch(industryId: string, query: string) {
  const params = new URLSearchParams();
  if (industryId) params.set('industry', industryId);
  if (query.trim()) params.set('q', query.trim());
  const value = params.toString();
  return value ? `?${value}` : '';
}

function compactModelPayload(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())) as Record<string, string>;
}
