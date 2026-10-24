import { ArrowLeft, ImageOff, Loader2, PackagePlus, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { InfoHint } from '../../components/InfoHint';
import { EquipmentAreaNav } from '../../components/EquipmentAreaNav';
import { Button } from '../../components/ui/button';
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
  manufacturer?: string | null;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const catalogQuery = useCatalogOverview();
  const role = getRoleName(user);
  const userExpertise = getUserExpertiseGroups(user);
  const canAddProduct = role === 'admin' || role === 'engineer';
  const canDeleteModel = role === 'admin';
  const deleteModelMutation = useMutation({
    mutationFn: (modelId: string) => apiFetch(`/machine-models/${modelId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
  });
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<MachineModel | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'empty'>('all');
  const [selectedIndustryId, setSelectedIndustryId] = useState(() => searchParams.get('industry') ?? '');
  const industries = catalogQuery.data?.industries ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error
    ? catalogQuery.error.message
    : deleteModelMutation.error instanceof Error
      ? deleteModelMutation.error.message
      : '';

  const visibleIndustries = useMemo(() => industries.filter((industry) => role !== 'engineer' || !userExpertise.length || userExpertise.includes(industry.expertiseGroup)), [industries, role, userExpertise]);
  const visibleModels = useMemo(() => models.filter((model) => {
    const group = model.businessLine?.productIndustry?.expertiseGroup;
    return role !== 'engineer' || !userExpertise.length || Boolean(group && userExpertise.includes(group));
  }), [models, role, userExpertise]);
  const stockByIndustry = useMemo(() => buildStockByIndustry(visibleModels, stockByModel), [visibleModels, stockByModel]);
  const industryCards = useMemo(() => buildIndustryCards(visibleIndustries, visibleModels, stockByIndustry), [stockByIndustry, visibleIndustries, visibleModels]);
  const keyword = query.trim().toLocaleLowerCase('vi');
  const matchingIndustries = industryCards.filter((item) => {
    const namedMatch = !keyword || item.name.toLocaleLowerCase('vi').includes(keyword);
    const hasMatchingModels = visibleModels.some((model) => model.businessLine?.productIndustry?.id === item.id && (!keyword || [model.code, model.name, model.displayName, model.manufacturer].filter(Boolean).some((value) => String(value).toLocaleLowerCase('vi').includes(keyword))));
    const hasStock = stockFilter === 'all' || (stockFilter === 'in-stock' ? item.stock.inStock > 0 : item.stock.inStock === 0);
    return hasStock && (namedMatch || hasMatchingModels);
  });
  const selectedIndustry = matchingIndustries.find((item) => item.id === selectedIndustryId) ?? matchingIndustries[0] ?? null;
  const selectedIndustryGroup = visibleIndustries.find((industry) => industry.id === selectedIndustry?.id)?.expertiseGroup;
  const filteredModels = useMemo(() => sortModelsForIndustry(visibleModels.filter((model) => {
    if (model.businessLine?.productIndustry?.id !== selectedIndustry?.id) return false;
    const matchesQuery = !keyword || [model.code, model.name, model.displayName, model.manufacturer, model.productLine, model.businessLine?.name, model.businessLine?.productIndustry?.name]
      .filter(Boolean).some((value) => String(value).toLocaleLowerCase('vi').includes(keyword));
    const stock = stockByModel[model.id] ?? { inStock: 0, total: 0 };
    const matchesStock = stockFilter === 'all' || (stockFilter === 'in-stock' ? stock.inStock > 0 : stock.inStock === 0);
    return matchesQuery && matchesStock;
  }), selectedIndustryGroup), [keyword, selectedIndustry?.id, selectedIndustryGroup, stockByModel, stockFilter, visibleModels]);
  return (
    <PageFrame>
      <EquipmentAreaNav active="catalog" />
      <CatalogPortalHero
        canAddModel={role === 'admin'}
        canAddProduct={canAddProduct}
        loading={loading}
        onAddModel={() => {
          if (selectedIndustry) {
            navigate(`/product-catalog/industries/${selectedIndustry.id}?addModel=1&returnToCatalog=1`);
          }
        }}
        onRefresh={() => void catalogQuery.refetch()}
        selectedIndustryAvailable={Boolean(selectedIndustry)}
      />
      {error ? <Notice message={error} /> : null}

      {loading ? <CatalogLoading label="Đang tải ngành hàng" /> : null}

      {!loading ? (
        <CatalogBrowser
          industries={matchingIndustries}
          models={filteredModels}
          query={query}
          selectedIndustry={selectedIndustry}
          selectedIndustryId={selectedIndustry?.id ?? ''}
          stockByModel={stockByModel}
          stockFilter={stockFilter}
          canAddProduct={canAddProduct}
          canDeleteModel={canDeleteModel}
          onIndustryChange={setSelectedIndustryId}
          onDeleteModel={setPendingDelete}
          deletingModel={deleteModelMutation.isPending ? deleteModelMutation.variables : undefined}
          onQueryChange={setQuery}
          onStockFilterChange={setStockFilter}
          onOpenModel={(modelId) => navigate(`/business-lines/models/${modelId}`)}
        />
      ) : null}

      {pendingDelete ? <ConfirmDeleteModel model={pendingDelete} loading={deleteModelMutation.isPending} onCancel={() => setPendingDelete(null)} onConfirm={() => deleteModelMutation.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })} /> : null}

      {!loading && matchingIndustries.length === 0 ? <CatalogEmpty label="Chưa có thiết bị phù hợp với lựa chọn này." /> : null}
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
  const [modelIndustryId, setModelIndustryId] = useState(industryId);
  const [modelFormError, setModelFormError] = useState('');
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MachineModel | null>(null);
  const catalogQuery = useCatalogOverview();
  const role = getRoleName(user);
  const userExpertise = getUserExpertiseGroups(user);
  const canAddProduct = role === 'admin' || role === 'engineer';
  const canAddModel = role === 'admin';
  const deleteModelMutation = useMutation({
    mutationFn: (modelId: string) => apiFetch(`/machine-models/${modelId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
  });
  const industries = catalogQuery.data?.industries ?? [];
  const businessLines = catalogQuery.data?.businessLines ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error
    ? catalogQuery.error.message
    : deleteModelMutation.error instanceof Error
      ? deleteModelMutation.error.message
      : '';
  const industry = industries.find((item) => item.id === industryId) ?? null;
  const modelIndustry = industries.find((item) => item.id === modelIndustryId) ?? null;
  const modelIndustryBusinessLines = useMemo(() => businessLines.filter((line) => line.productIndustry?.id === modelIndustryId), [businessLines, modelIndustryId]);
  const selectedBusinessLine = modelIndustryBusinessLines.find((line) => line.id === modelForm.businessLineId) ?? null;

  useEffect(() => setModelIndustryId(industryId), [industryId]);

  useEffect(() => {
    if (loading || searchParams.get('addModel') !== '1') return;

    if (canAddModel) {
      openModelForm();
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('addModel');
    setSearchParams(nextParams, { replace: true });
  }, [canAddModel, loading, searchParams, setSearchParams]);

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortModelsForIndustry(models.filter((model) => {
      const industry = model.businessLine?.productIndustry;
      const matchesIndustry = industry?.id === industryId;
      const matchesExpertise = role !== 'engineer' || !userExpertise.length || Boolean(industry?.expertiseGroup && userExpertise.includes(industry.expertiseGroup));
      const matchesQuery =
        !normalizedQuery ||
        [model.code, model.name, model.displayName, model.manufacturer, model.productLine, model.businessLine?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesIndustry && matchesExpertise && matchesQuery;
    }), industry?.expertiseGroup);
  }, [industry?.expertiseGroup, industryId, models, query, role, userExpertise]);

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
      if (searchParams.get('returnToCatalog') === '1') {
        navigate(`/product-catalog?industry=${encodeURIComponent(modelIndustryId)}`);
      } else if (modelIndustryId !== industryId) {
        navigate(`/product-catalog/industries/${modelIndustryId}`);
      }
    },
    onError: (mutationError) => {
      setModelFormError(mutationError instanceof Error ? mutationError.message : 'Không thể tạo model mới.');
    },
  });

  function openModelForm() {
    // Do not silently select the first brand/group when an industry has many.
    setModelIndustryId(industryId);
    setModelForm(emptyModelForm);
    setModelFormError('');
    setModelModalOpen(true);
  }

  function closeModelForm() {
    setModelModalOpen(false);
    if (searchParams.get('returnToCatalog') === '1') {
      navigate(`/product-catalog?industry=${encodeURIComponent(modelIndustryId || industryId)}`);
    }
  }

  function updateModelForm(field: keyof ModelFormState, value: string) {
    if (field === 'businessLineId') {
      const line = modelIndustryBusinessLines.find((item) => item.id === value) ?? null;
      setModelForm((current) => ({
        ...current,
        businessLineId: value,
        manufacturer: line?.manufacturer ?? '',
        countryOfOrigin: line?.countryOfOrigin ?? '',
        productCategory: line?.productCategory ?? '',
        productLine: '',
      }));
      return;
    }
    setModelForm((current) => ({ ...current, [field]: value }));
  }

  function updateModelIndustry(value: string) {
    setModelIndustryId(value);
    setModelForm((current) => ({ ...current, businessLineId: '', manufacturer: '', countryOfOrigin: '', productCategory: '', productLine: '' }));
    setModelFormError('');
  }

  function submitModelForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = modelForm.code.trim().toUpperCase();
    const name = modelForm.name.trim();

    if (!modelForm.businessLineId) {
      setModelFormError('Vui lòng chọn ngành hàng và nhóm sản phẩm.');
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
      <EquipmentAreaNav active="catalog" />
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
              eyebrow="Model máy"
              title={industry?.name || 'Ngành hàng'}
            />
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tổng quan ngành hàng">
              <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold tabular-nums text-[#475467]">{visibleModels.length} model</span>
              <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold tabular-nums text-[#475467]">{industryStock.total} máy</span>
              <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold tabular-nums text-[#475467]">{industryStock.inStock} trong kho</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
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
          canDeleteModel={canAddModel}
          catalogSearch={catalogSearch}
          deletingModel={deleteModelMutation.isPending ? deleteModelMutation.variables : undefined}
          models={visibleModels}
          onDeleteModel={setPendingDelete}
          onOpenModel={openModelDetail}
          stockByModel={stockByModel}
        />
      ) : null}

      {modelModalOpen ? (
        <AddModelModal
          businessLines={modelIndustryBusinessLines}
          error={modelFormError}
          form={modelForm}
          industries={industries}
          industryId={modelIndustryId}
          loading={createModelMutation.isPending}
          onChange={updateModelForm}
          onClose={closeModelForm}
          onIndustryChange={updateModelIndustry}
          onSubmit={submitModelForm}
          selectedIndustryName={modelIndustry?.name ?? 'Chọn ngành hàng'}
          selectedBusinessLine={selectedBusinessLine}
        />
      ) : null}
      {pendingDelete ? <ConfirmDeleteModel model={pendingDelete} loading={deleteModelMutation.isPending} onCancel={() => setPendingDelete(null)} onConfirm={() => deleteModelMutation.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })} /> : null}
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
  canAddModel,
  canAddProduct,
  loading,
  onAddModel,
  onRefresh,
  selectedIndustryAvailable,
}: {
  canAddModel: boolean;
  canAddProduct: boolean;
  loading: boolean;
  onAddModel: () => void;
  onRefresh: () => void;
  selectedIndustryAvailable: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-[#e4e4e7] bg-white shadow-[0_12px_30px_rgba(24,24,27,0.045)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[#177245]" />
      <div className="grid gap-5 p-5 pl-6 sm:p-6 sm:pl-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Thiết bị y tế</span>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#18181b] sm:text-[30px]">Danh mục thiết bị</h1>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {canAddModel ? (
            <button className="secondary-button bg-white" disabled={loading || !selectedIndustryAvailable} onClick={onAddModel} type="button">
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
          <button className="secondary-button bg-white" disabled={loading} onClick={onRefresh} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </div>
      </div>
    </section>
  );
}

function CatalogBrowser({
  canAddProduct,
  canDeleteModel,
  industries,
  models,
  onDeleteModel,
  onIndustryChange,
  onOpenModel,
  onQueryChange,
  onStockFilterChange,
  query,
  selectedIndustry,
  selectedIndustryId,
  stockByModel,
  stockFilter,
  deletingModel,
}: {
  canAddProduct: boolean;
  canDeleteModel: boolean;
  industries: Array<{ id: string; name: string; expertise: string; modelCount: number; stock: ModelStock }>;
  models: MachineModel[];
  onDeleteModel: (model: MachineModel) => void;
  deletingModel?: string;
  onIndustryChange: (id: string) => void;
  onOpenModel: (id: string) => void;
  onQueryChange: (value: string) => void;
  onStockFilterChange: (value: 'all' | 'in-stock' | 'empty') => void;
  query: string;
  selectedIndustry: { id: string; name: string; expertise: string; modelCount: number; stock: ModelStock } | null;
  selectedIndustryId: string;
  stockByModel: Record<string, ModelStock>;
  stockFilter: 'all' | 'in-stock' | 'empty';
}) {
  const filters: Array<{ label: string; value: 'all' | 'in-stock' | 'empty' }> = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Còn kho', value: 'in-stock' },
    { label: 'Hết kho', value: 'empty' },
  ];
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#e4e4e7] bg-white shadow-[0_8px_24px_rgba(24,24,27,0.045)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9ecef] bg-[#fafbfa] p-3 sm:p-4">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
          <input className="h-11 w-full rounded-xl border border-[#e1e5e9] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#177245] focus:ring-2 focus:ring-[#177245]/10" onChange={(event) => onQueryChange(event.target.value)} placeholder="Tìm tên thiết bị, model hoặc hãng" value={query} />
        </label>
        <div aria-label="Lọc theo tình trạng kho" className="flex flex-wrap gap-1 rounded-xl border border-[#e4e4e7] bg-white p-1">
          {filters.map((item) => {
            const active = stockFilter === item.value;
            return (
              <Button
                className={active ? 'bg-[#202124] text-white shadow-none' : 'border-0 bg-transparent text-[#667085] hover:bg-[#f5f6f7]'}
                key={item.value}
                onClick={() => onStockFilterChange(item.value)}
                size="sm"
                type="button"
                variant={active ? 'default' : 'ghost'}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-[480px] min-[1800px]:grid-cols-[minmax(210px,0.72fr)_minmax(0,2fr)]">
        <nav aria-label="Ngành hàng thiết bị" className="flex flex-wrap gap-2 border-b border-[#e9ecef] bg-[#f8faf9] p-3 min-[1800px]:block min-[1800px]:space-y-1 min-[1800px]:border-b-0 min-[1800px]:border-r min-[1800px]:p-3">
          <p className="hidden px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a8580] min-[1800px]:block">Ngành hàng</p>
          {industries.map((item) => {
            const active = selectedIndustryId === item.id;
            return <button aria-pressed={active} className={`flex min-w-max items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition min-[1800px]:w-full ${active ? 'bg-white font-semibold text-[#155c38] shadow-[0_2px_8px_rgba(24,24,27,0.08)] ring-1 ring-[#cfe2d6]' : 'text-[#475467] hover:bg-white'}`} key={item.id} onClick={() => onIndustryChange(item.id)} type="button">
              <span className="truncate">{item.name}</span><span className="text-xs tabular-nums text-[#77827d]">{item.modelCount}</span>
            </button>;
          })}
        </nav>
        <div className="min-w-0 p-3 sm:p-5">
          {selectedIndustry ? <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#edf0ed] pb-4">
              <div><span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7a8580]">{selectedIndustry.expertise}</span><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#202124]">{selectedIndustry.name}</h2></div>
              <div className="text-sm text-[#667085]">{models.length} model · {selectedIndustry.stock.inStock} máy còn kho</div>
            </div>
            {models.length ? <CatalogModelTable canAddProduct={canAddProduct} canDeleteModel={canDeleteModel} catalogSearch={`${selectedIndustryId}:${query}:${stockFilter}`} deletingModel={deletingModel} models={models} onDeleteModel={onDeleteModel} onOpenModel={onOpenModel} stockByModel={stockByModel} /> : <p className="rounded-xl bg-[#f8faf9] px-4 py-8 text-center text-sm text-[#667085]">Không có model phù hợp trong ngành hàng này.</p>}
          </> : <p className="py-16 text-center text-sm text-[#667085]">Không có ngành hàng phù hợp.</p>}
        </div>
      </div>
    </section>
  );
}

function CatalogModelTable({
  canAddProduct,
  canDeleteModel,
  catalogSearch,
  deletingModel,
  models,
  onDeleteModel,
  onOpenModel,
  stockByModel,
}: {
  canAddProduct: boolean;
  canDeleteModel: boolean;
  catalogSearch: string;
  deletingModel?: string;
  models: MachineModel[];
  onDeleteModel: (model: MachineModel) => void;
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
      <div className="grid gap-2 p-3 min-[1400px]:hidden">
        {pagedModels.map((model) => {
          const stock = stockByModel[model.id] ?? { inStock: 0, total: 0 };
          return <article className="grid gap-3 rounded-xl border border-[#e7e9ec] bg-white p-3 transition hover:bg-[#fafafa]" key={model.id}>
            <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => onOpenModel(model.id)} type="button">
              <ModelImage model={model} />
              <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-[#202124]">{modelShortLabel(model)}</strong><span className="mt-0.5 block truncate text-xs text-[#667085]">{modelProductName(model)}</span></span>
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#eef0f2] pt-2 text-xs text-[#667085]">
              <span className="max-w-full font-medium text-[#344054]">{productLineDisplayLabel(model)}</span>
              <span>{model.manufacturer || 'Chưa có hãng'}</span>
              <span>{modelOrigin(model) || 'Chưa rõ xuất xứ'}</span>
              <span className="rounded-full bg-[#eefaf3] px-2 py-1 font-semibold text-[#177245]">{stock.inStock}/{stock.total} kho</span>
            </div>
            <div className="flex gap-2">
              {canAddProduct ? <Link aria-label={`Thêm máy ${modelShortLabel(model)}`} className="primary-button compact flex-1 justify-center" onClick={(event) => event.stopPropagation()} to={`/business-lines/add-product?modelId=${model.id}`}><PackagePlus size={15} />Thêm máy</Link> : null}
              {canDeleteModel ? <button aria-label={`Xóa model ${modelShortLabel(model)}`} className="danger-button compact" disabled={deletingModel === model.id} onClick={(event) => { event.stopPropagation(); onDeleteModel(model); }} title="Xóa model" type="button">{deletingModel === model.id ? <Loader2 className="spin-icon" size={15} /> : <Trash2 size={15} />}</button> : null}
            </div>
          </article>;
        })}
      </div>
      <div className="hidden w-full overflow-hidden min-[1400px]:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#f8faf9] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
            <tr className="border-b border-[#e4e4e7]">
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Tên sản phẩm</th>
              <th className="whitespace-nowrap px-4 py-3">Dòng sản phẩm</th>
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
                canDeleteModel={canDeleteModel}
                catalogSearch={catalogSearch}
                deleting={deletingModel === model.id}
                key={model.id}
                model={model}
                onDelete={() => onDeleteModel(model)}
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
  canDeleteModel,
  deleting,
  model,
  onDelete,
  onOpen,
  stock,
}: {
  canAddProduct: boolean;
  canDeleteModel: boolean;
  deleting: boolean;
  catalogSearch: string;
  model: MachineModel;
  onDelete: () => void;
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
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <ModelImage model={model} />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-[#202124]">{modelShortLabel(model)}</span>
            <span className="mt-0.5 block max-w-[190px] truncate text-xs text-[#667085]" title={model.businessLine?.name || model.name}>{model.businessLine?.name || model.name}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="block text-sm font-medium text-[#344054]">{modelProductName(model)}</span>
        {model.displayName && model.displayName !== modelProductName(model) ? <span className="mt-0.5 block max-w-[250px] truncate text-xs text-[#667085]">{model.displayName}</span> : null}
      </td>
      <td className="px-3 py-3 text-sm">
        <span className="block font-medium text-[#344054]">{productLineDisplayLabel(model)}</span>
        {model.productLine ? <span className="mt-0.5 block text-xs text-[#667085]">{model.productLine}</span> : null}
      </td>
      <td className="px-3 py-3 text-sm text-[#344054]"><span className="block truncate" title={model.manufacturer || 'Chưa có hãng'}>{model.manufacturer || 'Chưa có hãng'}</span></td>
      <td className="px-3 py-3 text-sm text-[#344054]"><span className="block truncate" title={modelOrigin(model) || '-'}>{modelOrigin(model) || '-'}</span></td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{inStock}/{total} kho</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          {canDeleteModel ? <button aria-label={`Sửa model ${modelShortLabel(model)}`} className="secondary-button compact !min-w-0 !px-2" onClick={(event) => { event.stopPropagation(); onOpen(model.id); }} title="Mở chi tiết model" type="button"><Pencil size={15} /></button> : null}
          {canAddProduct ? (
            <Link aria-label={`Thêm máy ${modelShortLabel(model)}`} className="primary-button compact !min-w-0 !px-2" onClick={(event) => event.stopPropagation()} title="Thêm máy" to={`/business-lines/add-product?modelId=${model.id}`}>
              <PackagePlus size={15} />
              <span className="sr-only">Thêm máy</span>
            </Link>
          ) : null}
          {canDeleteModel ? (
            <button
              aria-label={`Xóa model ${modelShortLabel(model)}`}
              className="danger-button compact !min-w-0 !px-2"
              disabled={deleting}
              onClick={(event) => { event.stopPropagation(); onDelete(); }}
              title={deleting ? 'Đang xóa model' : 'Xóa model'}
              type="button"
            >
              {deleting ? <Loader2 className="spin-icon" size={15} /> : <Trash2 size={15} />}
            </button>
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
  industries,
  industryId,
  loading,
  onChange,
  onClose,
  onIndustryChange,
  onSubmit,
  selectedIndustryName,
  selectedBusinessLine,
}: {
  businessLines: BusinessLine[];
  error: string;
  form: ModelFormState;
  industries: ProductIndustry[];
  industryId: string;
  loading: boolean;
  onChange: (field: keyof ModelFormState, value: string) => void;
  onClose: () => void;
  onIndustryChange: (industryId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedIndustryName: string;
  selectedBusinessLine: BusinessLine | null;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#18181b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[26px] border border-[#e4e4e7] bg-white p-5 shadow-[0_30px_90px_rgba(24,24,27,0.28)]" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-[#eeeeee] pb-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667985]">Danh mục model</span>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#1f1f1f]">Thêm model thiết bị</h2>
          </div>
          <button className="secondary-button compact bg-white" onClick={onClose} type="button" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ModelFormField label="Ngành hàng">
            <select className="form-input" onChange={(event) => onIndustryChange(event.target.value)} value={industryId}>
              <option value="">Chọn ngành hàng</option>
              {industries.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}
            </select>
          </ModelFormField>

          {businessLines.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafafa] p-5">
            <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">
              {industryId ? 'Chưa có nhóm sản phẩm' : 'Chưa chọn ngành hàng'}
            </span>
            {industryId ? <InfoHint content={`Ngành hàng ${selectedIndustryName} chưa có nhóm. Tạo nhóm tại Ngành hàng → Nhóm sản phẩm.`} label="Thiếu nhóm sản phẩm" /> : null}
          </div>
        ) : (
            <ModelFormField label="Nhóm sản phẩm / thương hiệu">
              <select className="form-input" onChange={(event) => onChange('businessLineId', event.target.value)} value={form.businessLineId}>
                <option value="">Chọn nhóm thuộc {selectedIndustryName}</option>
                {businessLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {[line.name, line.manufacturer, productCategoryLabel(line.productCategory)].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </ModelFormField>
          )}

          <ModelFormField label="Model">
              <input className="form-input uppercase" onChange={(event) => onChange('code', event.target.value)} placeholder="VD: X-CUBE 50" value={form.code} />
            </ModelFormField>
            <ModelFormField label="Tên sản phẩm">
              <input className="form-input" onChange={(event) => onChange('name', event.target.value)} placeholder="VD: Máy siêu âm X-CUBE 50" value={form.name} />
            </ModelFormField>
            <ModelFormField label="Tên hiển thị">
              <input className="form-input" onChange={(event) => onChange('displayName', event.target.value)} placeholder="Không bắt buộc" value={form.displayName} />
            </ModelFormField>
            <ModelFormField label="Dòng máy / series (tuỳ chọn)">
              <input className="form-input" onChange={(event) => onChange('productLine', event.target.value)} placeholder="VD: X-CUBE, BC, HD, Lumipulse, WTS" value={form.productLine} />
            </ModelFormField>
            <div className="grid gap-2 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-4 text-sm md:col-span-2">
              <strong className="text-[#333333]">Thông tin kế thừa từ nhóm sản phẩm</strong>
              {selectedBusinessLine ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[#667085]">
                  <span>Hãng: <strong className="text-[#333333]">{selectedBusinessLine.manufacturer || 'Chưa khai báo'}</strong></span>
                  <span>Phân loại: <strong className="text-[#333333]">{productCategoryLabel(selectedBusinessLine.productCategory)}</strong></span>
                  <span>Xuất xứ: <strong className="text-[#333333]">{selectedBusinessLine.countryOfOrigin || 'Chưa khai báo'}</strong></span>
                </div>
              ) : null}
            </div>
            <label className="grid gap-2 text-sm font-bold text-[#333333] md:col-span-2">
              Ghi chú
              <textarea className="min-h-24 rounded-2xl border border-[#d8dee8] bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]" onChange={(event) => onChange('note', event.target.value)} placeholder="Quy cách đóng gói, kích thước..." value={form.note} />
            </label>
        </div>

        {error ? <Notice message={error} /> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#eeeeee] pt-4">
          <button className="secondary-button" onClick={onClose} type="button">
            Hủy
          </button>
          <button className="primary-button" disabled={loading || !industryId || businessLines.length === 0 || !form.businessLineId} type="submit">
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

function ConfirmDeleteModel({ model, loading, onCancel, onConfirm }: { model: MachineModel; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#101828]/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
      <section aria-labelledby="delete-model-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-[0_24px_70px_rgba(16,24,40,0.24)]" role="dialog">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fef3f2] text-[#b42318]"><Trash2 size={19} /></span>
          <div><h2 className="text-base font-semibold text-[#101828]" id="delete-model-title">Xóa model này?</h2><p className="mt-1 text-sm leading-6 text-[#475467]">Bạn đang xóa <strong className="font-semibold text-[#344054]">{modelProductName(model)}</strong>. Chỉ xóa được model chưa có máy, phụ kiện hoặc lịch sử liên quan.</p></div>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button className="secondary-button" disabled={loading} onClick={onCancel} type="button">Giữ lại</button><button className="danger-button" disabled={loading} onClick={onConfirm} type="button">{loading ? <Loader2 className="spin-icon" size={16} /> : <Trash2 size={16} />}Xóa model</button></div>
      </section>
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

function getUserExpertiseGroups(user: ApiUser): ExpertiseGroup[] {
  const profile = user.engineerProfile;
  if (profile?.expertiseGroups?.length) return profile.expertiseGroups;
  return profile?.expertiseGroup ? [profile.expertiseGroup] : [];
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

function modelProductName(model: MachineModel) {
  const category = productLineDisplayLabel(model);
  const modelCode = model.code?.trim();
  if (category !== 'Chưa có dòng sản phẩm' && modelCode) return `${category} ${modelCode}`;
  return model.name?.trim() || model.displayName?.trim() || modelCode || 'Chưa có tên model';
}

function productLineDisplayLabel(model: MachineModel) {
  const category = model.productCategory ?? model.businessLine?.productCategory;
  const labels: Record<string, string> = {
    ULTRASOUND: 'Máy siêu âm',
    LAB_TESTING: 'Máy xét nghiệm',
    BIOCHEMISTRY: 'Máy sinh hóa',
    IMMUNOLOGY: 'Máy miễn dịch',
    HEMATOLOGY: 'Máy huyết học',
    X_RAY: 'Máy X-quang',
    ENDOSCOPY: 'Máy nội soi',
  };
  const categoryLabel = category && labels[category];
  if (categoryLabel) return categoryLabel;
  const businessLineName = model.businessLine?.name?.trim();
  if (!businessLineName) return 'Chưa có dòng sản phẩm';
  return businessLineName.toLocaleLowerCase('vi').startsWith('máy ')
    ? businessLineName
    : `Máy ${businessLineName}`;
}

function sortModelsForIndustry(models: MachineModel[], expertiseGroup?: ExpertiseGroup) {
  const direction = expertiseGroup === 'IMAGING' ? -1 : 1;
  return [...models].sort((first, second) =>
    direction * modelProductName(first).localeCompare(modelProductName(second), 'vi', { sensitivity: 'base', numeric: true }) ||
    direction * first.code.localeCompare(second.code, 'vi', { sensitivity: 'base', numeric: true }),
  );
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
