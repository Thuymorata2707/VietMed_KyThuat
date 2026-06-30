import { ArrowLeft, ArrowRight, BarChart3, Boxes, ImageOff, Layers3, Loader2, PackagePlus, Plus, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
  industries: ProductIndustry[];
  models: MachineModel[];
  stockByModel: Record<string, ModelStock>;
};

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
  const { industryId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const catalogQuery = useCatalogOverview();
  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const industries = catalogQuery.data?.industries ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';
  const industry = industries.find((item) => item.id === industryId) ?? null;

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

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[28px] border border-[#f0d7d9] bg-[#fffafa] p-5 shadow-[0_24px_70px_rgba(120,20,28,0.08)] md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(215,25,32,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(215,25,32,0.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#f5c7cb]/35 blur-3xl" />
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

        <label className="relative mt-5 flex h-13 min-w-0 items-center gap-3 rounded-2xl border border-[#f0d7d9] bg-white/88 px-4 text-[#666666] shadow-[0_14px_36px_rgba(120,20,28,0.08)] focus-within:border-[#d71920] focus-within:shadow-[0_0_0_4px_rgba(215,25,32,0.12)]">
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

      {!loading ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleModels.map((model) => (
            <CatalogModelTile canAddProduct={canAddProduct} catalogSearch={catalogSearch} key={model.id} model={model} stock={stockByModel[model.id]} />
          ))}
        </section>
      ) : null}
    </PageFrame>
  );
}

function useCatalogOverview() {
  return useQuery({
    queryKey: queryKeys.productCatalog.overview,
    queryFn: async (): Promise<ProductCatalogOverview> => {
      const [industryResult, nextModels, machines] = await Promise.all([
        apiFetch<Paginated<ProductIndustry>>('/product-industries?limit=100'),
        apiFetchAllPages<MachineModel>('/machine-models'),
        apiFetchAllPages<CatalogMachine>('/machines'),
      ]);

      return {
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
    <section className="relative overflow-hidden rounded-[28px] border border-[#f0d7d9] bg-[#fff7f8] px-5 py-10 text-center shadow-[0_24px_70px_rgba(120,20,28,0.08)] md:px-8 md:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(215,25,32,0.075)_1px,transparent_1px),linear-gradient(180deg,rgba(120,20,28,0.055)_1px,transparent_1px)] bg-[size:70px_70px]" />
      <div className="pointer-events-none absolute left-10 top-8 h-40 w-40 rounded-full bg-white/70 blur-3xl" />
      <div className="pointer-events-none absolute right-24 top-16 h-28 w-28 rotate-45 rounded-[28px] bg-[#f5c7cb]/34" />
      <div className="relative mx-auto max-w-4xl">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#f0d7d9] bg-white/84 px-4 text-sm font-bold text-[#b5121b] shadow-[0_10px_28px_rgba(120,20,28,0.08)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d71920]" />
          Catalog sản phẩm VietMed
        </span>
        <h1 className="mt-6 text-[clamp(42px,7vw,86px)] font-black leading-[0.95] tracking-[-0.055em] text-[#1f1f1f]">Sản phẩm & Thiết bị</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-[#66565a]">Chọn ngành hàng, mở model máy, xem tồn kho và chi tiết serial.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
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
        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          <MetricCard icon={<Boxes size={18} />} label="Tổng máy" subLabel={`${totals.inStock} còn kho`} value={totals.machines} />
          <MetricCard icon={<Layers3 size={18} />} label="Model" subLabel={`${totals.businessLines} dòng`} value={totals.models} />
          <MetricCard icon={<BarChart3 size={18} />} label="Ngành hàng" subLabel="nhóm chính" value={totals.industries} />
        </div>
      </div>
    </section>
  );
}

function IndustryPortalCard({ item }: { item: { id: string; name: string; expertise: string; modelCount: number; stock: ModelStock } }) {
  const ratio = item.stock.total ? Math.round((item.stock.inStock / item.stock.total) * 100) : 0;

  return (
    <Link
      className="group relative min-h-[172px] overflow-hidden rounded-[28px] border border-[#f0d7d9] bg-white/92 p-5 shadow-[0_18px_42px_rgba(120,20,28,0.08)] transition hover:-translate-y-1 hover:border-[#d71920]/35 hover:shadow-[0_26px_58px_rgba(120,20,28,0.12)]"
      to={`/product-catalog/industries/${item.id}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(215,25,32,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,250,250,0.9))]" />
      <div className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d71920,#f36b72)] text-white shadow-[0_16px_34px_rgba(215,25,32,0.24)]">
          <Boxes size={23} />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-xl font-black text-[#1f1f1f]">{item.name}</strong>
          <span className="mt-1 block text-sm font-semibold text-[#66565a]">{item.expertise}</span>
        </span>
      </div>
      <div className="relative mt-5 grid gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-[#f0d7d9] bg-white px-2.5 py-1 text-[#333333]">{item.modelCount} model</span>
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{item.stock.inStock}/{item.stock.total} còn kho</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#f3ecee]">
          <span className="block h-full rounded-full bg-[#d71920]" style={{ width: `${Math.max(ratio, item.stock.total ? 8 : 0)}%` }} />
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-black text-[#b5121b]">
          Mở model <ArrowRight className="transition group-hover:translate-x-1" size={16} />
        </span>
      </div>
    </Link>
  );
}

function CatalogModelTile({ canAddProduct, catalogSearch, model, stock }: { canAddProduct: boolean; catalogSearch: string; model: MachineModel; stock?: ModelStock }) {
  const total = stock?.total ?? 0;
  const inStock = stock?.inStock ?? 0;

  return (
    <article className="group grid min-h-[176px] grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-[28px] border border-[#f0d7d9] bg-white/94 p-5 shadow-[0_16px_38px_rgba(120,20,28,0.08)] transition hover:-translate-y-1 hover:border-[#d71920]/35 hover:shadow-[0_24px_52px_rgba(120,20,28,0.11)]">
      <Link to={`/business-lines/models/${model.id}${catalogSearch}`}>
        <ModelImage large model={model} />
      </Link>
      <div className="grid min-w-0 gap-3">
        <Link className="min-w-0" to={`/business-lines/models/${model.id}${catalogSearch}`}>
          <strong className="block truncate text-xl font-black text-[#1f1f1f]">{modelShortLabel(model)}</strong>
          <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-5 text-[#66565a]">{modelDetailLabel(model)}</span>
        </Link>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-[#f0d7d9] bg-[#fffafa] px-2.5 py-1 text-[#333333]">{model.manufacturer || 'Chưa có hãng'}</span>
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{inStock}/{total} kho</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="secondary-button compact bg-white" to={`/business-lines/models/${model.id}${catalogSearch}`}>
            Chi tiết
          </Link>
          {canAddProduct ? (
            <Link className="primary-button compact" to={`/business-lines/add-product?modelId=${model.id}`}>
              <PackagePlus size={15} />
              Thêm máy
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetricCard({ icon, label, subLabel, value }: { icon: ReactNode; label: string; subLabel: string; value: number }) {
  return (
    <div className="grid gap-3 rounded-[22px] border border-white/80 bg-white/86 p-4 text-left shadow-[0_18px_34px_rgba(120,20,28,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#66565a]">{label}</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0f2] text-[#d71920]">{icon}</span>
      </div>
      <strong className="text-3xl font-black leading-none text-[#1f1f1f]">{value}</strong>
      <span className="text-xs font-semibold text-[#7a6367]">{subLabel}</span>
    </div>
  );
}

function CatalogLoading({ label }: { label: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#f0d7d9] bg-[#fffafa] p-8 text-center text-sm font-semibold text-[#666666]">
      <Loader2 className="spin-icon mx-auto mb-2" size={20} />
      {label}
    </div>
  );
}

function CatalogEmpty({ label }: { label: string }) {
  return <div className="rounded-[28px] border border-dashed border-[#f0d7d9] bg-[#fffafa] p-8 text-center text-sm text-[#666666]">{label}</div>;
}

function ModelImage({ model, large = false }: { model?: MachineModel | null; large?: boolean }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = model?.businessLine?.imageUrl;
  const sizeClass = large ? 'h-16 w-16' : 'h-12 w-12';

  if (!imageUrl || hasError) {
    return (
      <span className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl border border-[#f0d7d9] bg-[#fff7f8] text-[#9f6b70]`}>
        <ImageOff size={large ? 24 : 18} />
      </span>
    );
  }

  return (
    <span className={`${sizeClass} block shrink-0 overflow-hidden rounded-2xl border border-[#f0d7d9] bg-white`}>
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

function modelOrigin(model: MachineModel) {
  return model.countryOfOrigin || model.businessLine?.countryOfOrigin || '';
}

function buildCatalogSearch(industryId: string, query: string) {
  const params = new URLSearchParams();
  if (industryId) params.set('industry', industryId);
  if (query.trim()) params.set('q', query.trim());
  const value = params.toString();
  return value ? `?${value}` : '';
}
