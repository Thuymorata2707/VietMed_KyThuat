import { ArrowLeft, BarChart3, Boxes, ImageOff, Layers3, Loader2, PackagePlus, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { DateInput } from '../../components/DateInput';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { queryKeys } from '../../lib/queryKeys';
import { machineDisplayName, machineModelOptionLabel } from '../../utils/machineDisplayName';
import { formatMachineAccessoriesText, parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';

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
  note?: string | null;
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
  description?: string | null;
  note?: string | null;
  businessLine?: BusinessLine | null;
  components?: MachineComponent[];
};

type MachineModelDetail = MachineModel & {
  machines?: MachineItem[];
  inventorySummary?: Record<string, number>;
  warehouseQuantity?: number;
};

type MachineComponent = {
  id: string;
  code: string;
  name: string;
  accessories?: ComponentAccessory[];
};

type ComponentAccessory = {
  id: string;
  code: string;
  name: string;
  requiresSerial?: boolean;
};

type ModelStock = {
  inStock: number;
  total: number;
};

type ModelIndustryGroupItem = {
  id: string;
  name: string;
  expertise?: string;
  models: MachineModel[];
};

type MachineItem = {
  id: string;
  machineModelId?: string | null;
  machineCode?: string | null;
  serialNumber: string;
  inventoryStatus?: string | null;
  status?: string | null;
  customer?: { id: string; name: string } | null;
  _count?: { accessories?: number };
};

type CatalogMachine = {
  id: string;
  machineModelId?: string | null;
  inventoryStatus?: string | null;
};

type MachineAccessory = {
  id: string;
  code?: string | null;
  name: string;
  serialNumber?: string | null;
  note?: string | null;
  componentAccessory?: {
    name: string;
    component?: { name: string } | null;
  } | null;
};

type MachineDetail = MachineItem & {
  name?: string | null;
  modelName?: string | null;
  manufacturer?: string | null;
  productLine?: string | null;
  warehouseImportDate?: string | null;
  installDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  accessories?: MachineAccessory[];
  machineModel?: MachineModel | null;
  businessLine?: BusinessLine | null;
};

type ProductForm = {
  machineModelId: string;
  machineRows: string;
  manufacturingDate: string;
  warehouseImportDate: string;
  accessoriesText: string;
};

type ProductMachineRow = {
  serialNumber: string;
  machineCode: string;
  name: string;
  accessoriesText: string;
};

type ProductCatalogOverview = {
  industries: ProductIndustry[];
  models: MachineModel[];
  stockByModel: Record<string, ModelStock>;
};

const allIndustriesKey = 'all';

export function ProductCatalogPage({ user }: { user: ApiUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIndustryId, setSelectedIndustryId] = useState(searchParams.get('industry') || allIndustriesKey);
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';

  const catalogQuery = useQuery({
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

  const industries = catalogQuery.data?.industries ?? [];
  const models = catalogQuery.data?.models ?? [];
  const stockByModel = catalogQuery.data?.stockByModel ?? {};
  const loading = catalogQuery.isLoading || catalogQuery.isFetching;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';

  const visibleIndustries = useMemo(() => {
    if (role !== 'engineer' || !userExpertise) return industries;
    return industries.filter((industry) => industry.expertiseGroup === userExpertise);
  }, [industries, role, userExpertise]);

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return models.filter((model) => {
      const industryId = model.businessLine?.productIndustry?.id;
      const matchesIndustry = selectedIndustryId === allIndustriesKey || industryId === selectedIndustryId;
      const matchesExpertise = role !== 'engineer' || !userExpertise || model.businessLine?.productIndustry?.expertiseGroup === userExpertise;
      const matchesQuery =
        !normalizedQuery ||
        [model.code, model.name, model.displayName, model.manufacturer, model.productLine, model.businessLine?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesIndustry && matchesExpertise && matchesQuery;
    });
  }, [models, query, role, selectedIndustryId, userExpertise]);

  const stockByIndustry = useMemo(() => {
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
  }, [models, stockByModel]);

  const visibleIndustryStock = useMemo(
    () =>
      visibleIndustries.reduce(
        (total, industry) => {
          const stock = stockByIndustry[industry.id] ?? { inStock: 0, total: 0 };
          return {
            inStock: total.inStock + stock.inStock,
            total: total.total + stock.total,
          };
        },
        { inStock: 0, total: 0 },
      ),
    [stockByIndustry, visibleIndustries],
  );

  const catalogTotals = useMemo(() => {
    const businessLineIds = new Set(visibleModels.map((model) => model.businessLine?.id).filter(Boolean));
    return {
      models: visibleModels.length,
      businessLines: businessLineIds.size,
      machines: visibleIndustryStock.total,
      inStock: visibleIndustryStock.inStock,
    };
  }, [visibleIndustryStock, visibleModels]);
  const overviewIndustries = useMemo(
    () => buildIndustryOverviewItems(visibleIndustries, visibleModels, stockByIndustry),
    [stockByIndustry, visibleIndustries, visibleModels],
  );

  function updateCatalogState(nextIndustryId: string, nextQuery: string) {
    setSelectedIndustryId(nextIndustryId);
    setQuery(nextQuery);

    const nextParams = new URLSearchParams();
    if (nextIndustryId && nextIndustryId !== allIndustriesKey) nextParams.set('industry', nextIndustryId);
    if (nextQuery.trim()) nextParams.set('q', nextQuery.trim());
    setSearchParams(nextParams, { replace: true });
  }

  const catalogSearch = buildCatalogSearch(selectedIndustryId, query);

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Sản phẩm & Thiết bị"
          title="Danh sách sản phẩm"
          description="Model & tồn kho."
        />
        <div className="flex flex-wrap justify-end gap-2">
          {canAddProduct ? (
            <Link className="primary-button" to="/business-lines/add-product">
              <Plus size={17} />
              Add Product
            </Link>
          ) : null}
          <button className="secondary-button" disabled={loading} onClick={() => void catalogQuery.refetch()} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}

      <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#f4f4f5] shadow-[0_12px_30px_rgba(24,24,27,0.06)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(37,99,235,0.10),transparent_28%),radial-gradient(circle_at_92%_20%,rgba(228,228,231,0.52),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,253,245,0.82))]" />
        <div className="relative grid gap-5 p-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid content-between gap-6">
            <div>
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#e4e4e7] bg-white/82 px-3 text-xs font-semibold tracking-[0.08em] text-[#18181b] shadow-[0_8px_22px_rgba(24,24,27,0.08)]">
                Catalog overview
              </span>
              <h2 className="mt-4 max-w-3xl text-[clamp(26px,3.2vw,42px)] font-semibold leading-[1.04] tracking-[-0.035em] text-[#1f1f1f]">
                Danh mục sản phẩm theo ngành hàng.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667985]">
                Model, máy, tồn kho.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Link to="/technical-machines" className="block cursor-pointer rounded-[18px] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,24,27,0.08)]">
                <IndustryStockCard icon={<Boxes size={18} />} label="Tổng máy" value={catalogTotals.machines} subLabel={`${catalogTotals.inStock} còn kho`} />
              </Link>
              <IndustryStockCard icon={<Layers3 size={18} />} label="Model" value={catalogTotals.models} subLabel={`${catalogTotals.businessLines} nhóm sản phẩm`} />
              <IndustryStockCard icon={<BarChart3 size={18} />} label="Đang xem" value={visibleModels.length} subLabel="model sau lọc" />
            </div>
            <IndustryOverviewRail items={overviewIndustries} />
          </div>
          <IndustryMachineChart industries={visibleIndustries} stockByIndustry={stockByIndustry} />
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-3 shadow-[0_10px_30px_rgba(24,24,27,0.06)] md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
            <button
              className={industryTabClass(selectedIndustryId === allIndustriesKey)}
              onClick={() => updateCatalogState(allIndustriesKey, query)}
              type="button"
            >
              <span>Tất cả</span>
              <StockPill stock={visibleIndustryStock} />
            </button>
            {visibleIndustries.map((industry) => (
              <button
                className={industryTabClass(industry.id === selectedIndustryId)}
                key={industry.id}
                onClick={() => updateCatalogState(industry.id, query)}
                type="button"
              >
                <span>{industry.name}</span>
                <StockPill stock={stockByIndustry[industry.id] ?? { inStock: 0, total: 0 }} />
              </button>
            ))}
          </div>
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-[#fafafa] px-3 text-[#666666] focus-within:border-[#18181b] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]">
            <Search size={16} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-[#1f1f1f] outline-none"
              onChange={(event) => updateCatalogState(selectedIndustryId, event.target.value)}
              placeholder="Tìm model, hãng, nhóm sản phẩm"
              value={query}
            />
          </label>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fafafa] p-8 text-center text-sm font-semibold text-[#666666]">
            <Loader2 className="spin-icon mx-auto mb-2" size={20} />
            Đang tải danh sách sản phẩm
          </div>
        ) : null}

        {!loading && visibleModels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fafafa] p-8 text-center text-sm text-[#666666]">
            Không có model phù hợp với bộ lọc.
          </div>
        ) : null}

        {!loading && visibleModels.length ? (
          <ProductModelTable
            canAddProduct={canAddProduct}
            catalogSearch={catalogSearch}
            models={visibleModels}
            stockByModel={stockByModel}
          />
        ) : null}
      </section>

    </PageFrame>
  );
}

export function ProductModelDetailPage({ user }: { user: ApiUser }) {
  const navigate = useNavigate();
  const { modelId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const canEditModelImage = role === 'admin';
  const backIndustryId = searchParams.get('industry') || '';
  const backQuery = searchParams.get('q') || '';
  const backToCatalogHref = backIndustryId
    ? `/product-catalog/industries/${backIndustryId}${buildCatalogSearch('', backQuery)}`
    : '/product-catalog';

  const modelDetailQuery = useQuery({
    enabled: Boolean(modelId),
    queryKey: queryKeys.productCatalog.modelDetail(modelId),
    queryFn: async () => {
      const result = await apiFetch<MachineModelDetail>(`/machine-models/${modelId}`);
      if (role === 'engineer' && userExpertise && result.businessLine?.productIndustry?.expertiseGroup !== userExpertise) {
        throw new Error('Bạn không có quyền xem model của ngành hàng này.');
      }
      return result;
    },
  });

  const detail = modelDetailQuery.data ?? null;

  useEffect(() => {
    setSelectedMachineId('');
  }, [modelId]);

  useEffect(() => {
    if (detail) {
      setImageUrlDraft(detail.businessLine?.imageUrl ?? '');
    }
  }, [detail]);

  const machineDetailQuery = useQuery({
    enabled: Boolean(selectedMachineId),
    queryKey: queryKeys.productCatalog.machineDetail(selectedMachineId),
    queryFn: () => apiFetch<MachineDetail>(`/machines/${selectedMachineId}`),
  });

  const saveModelImageMutation = useMutation({
    mutationFn: async ({ businessLineId, imageUrl }: { businessLineId: string; imageUrl: string }) => {
      return apiFetch<BusinessLine>(`/business-lines/${businessLineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrl: imageUrl.trim() || null }),
      });
    },
    onSuccess: async (updatedBusinessLine) => {
      setImageUrlDraft(updatedBusinessLine.imageUrl ?? '');
      setSuccess('Đã cập nhật ảnh model.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.modelDetail(modelId) }),
      ]);
    },
  });

  const loadingModelDetail = modelDetailQuery.isLoading || modelDetailQuery.isFetching;
  const loadingMachineDetail = machineDetailQuery.isLoading || machineDetailQuery.isFetching;
  const savingModelImage = saveModelImageMutation.isPending;
  const selectedMachineDetail = machineDetailQuery.data ?? null;
  const error =
    formError ||
    (modelDetailQuery.error instanceof Error ? modelDetailQuery.error.message : '') ||
    (machineDetailQuery.error instanceof Error ? machineDetailQuery.error.message : '') ||
    (saveModelImageMutation.error instanceof Error ? saveModelImageMutation.error.message : '');

  async function saveModelImage() {
    const businessLineId = detail?.businessLine?.id;

    if (!businessLineId) {
      setFormError('Model này chưa gắn nhóm sản phẩm để cập nhật ảnh.');
      return;
    }

    setFormError('');
    setSuccess('');

    try {
      await saveModelImageMutation.mutateAsync({ businessLineId, imageUrl: imageUrlDraft });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không cập nhật được ảnh model.');
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Sản phẩm & Thiết bị"
          title={detail ? modelShortLabel(detail) : 'Chi tiết model'}
          description="Máy & phụ kiện."
        />
        <div className="flex flex-wrap justify-end gap-2">
          {detail && canAddProduct ? (
            <Link className="primary-button" to={`/business-lines/add-product?modelId=${detail.id}`}>
              <PackagePlus size={17} />
              Add Product
            </Link>
          ) : null}
          <button className="secondary-button" onClick={() => navigate(backToCatalogHref)} type="button">
            <ArrowLeft size={17} />
            Back
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {loadingModelDetail ? (
        <section className="rounded-lg border border-[#e5e5e5] bg-white p-6 text-sm font-semibold text-[#666666]">
          <Loader2 className="spin-icon mr-2 inline" size={18} />
          Đang tải chi tiết model
        </section>
      ) : null}

      {!loadingModelDetail && detail ? (
        <ModelDetailBlock
          canEditImage={canEditModelImage}
          detail={detail}
          imageUrlDraft={imageUrlDraft}
          loadingMachineDetail={loadingMachineDetail}
          loadingModelDetail={loadingModelDetail}
          machineDetail={selectedMachineDetail}
          model={detail}
          onImageUrlChange={setImageUrlDraft}
          onSaveImage={() => void saveModelImage()}
          onSelectMachine={(machineId) => {
            setFormError('');
            setSuccess('');
            setSelectedMachineId(machineId);
          }}
          savingImage={savingModelImage}
          selectedMachineId={selectedMachineId}
        />
      ) : null}
    </PageFrame>
  );
}

export function ProductAddPage({ user }: { user: ApiUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductForm>(emptyProductForm(searchParams.get('modelId') ?? ''));
  const [selectedProductId, setSelectedProductId] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const modelsQuery = useQuery({
    queryKey: queryKeys.productCatalog.addProductModels,
    queryFn: async () => {
      const allModels = await apiFetchAllPages<MachineModel>('/machine-models');
      return allModels.filter(
        (model) => role !== 'engineer' || !userExpertise || model.businessLine?.productIndustry?.expertiseGroup === userExpertise,
      );
    },
  });

  const models = modelsQuery.data ?? [];
  const selectedModel = models.find((model) => model.id === form.machineModelId) ?? null;
  const productOptions = useMemo(() => buildProductOptions(models), [models]);
  const modelOptions = useMemo(
    () => models.filter((model) => !selectedProductId || model.businessLine?.id === selectedProductId),
    [models, selectedProductId],
  );
  const supportsProbes = isUltrasoundMachineModel(selectedModel);
  const supportsEndoscopyChecklist = isEndoscopyMachineModel(selectedModel);
  const machineRows = useMemo(() => parseProductMachineRows(form.machineRows), [form.machineRows]);
  const duplicatedSerial = useMemo(() => findDuplicatedSerial(machineRows), [machineRows]);
  const [machinePreviewCode, setMachinePreviewCode] = useState('');

  useEffect(() => {
    if (!modelsQuery.data) return;
    const requestedModelId = searchParams.get('modelId') ?? '';
    const nextModelId = requestedModelId || models[0]?.id || '';
    const nextModel = models.find((model) => model.id === nextModelId) ?? models[0];

    setSelectedProductId(nextModel?.businessLine?.id || '');
    setForm((current) => {
      if (current.machineModelId && models.some((model) => model.id === current.machineModelId)) return current;
      return {
        ...current,
        machineModelId: nextModel?.id || '',
        accessoriesText: nextModel ? buildTemplateAccessoriesText(nextModel) : '',
      };
    });
  }, [models, modelsQuery.data, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const source = selectedModel?.code || selectedModel?.name || 'MAY';
    const params = new URLSearchParams({ source });

    void apiFetch<{ code?: string | null }>(`/machines/next-code?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setMachinePreviewCode(result.code || '');
      })
      .catch(() => {
        if (!cancelled) setMachinePreviewCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel?.code, selectedModel?.name]);

  const createMachineMutation = useMutation({
    mutationFn: async ({ currentForm, model }: { currentForm: ProductForm; model: MachineModel }) => {
      const rows = parseProductMachineRows(currentForm.machineRows);

      for (const row of rows) {
        const accessories = parseTemplateAccessoryLines(row.accessoriesText || currentForm.accessoriesText, model);
        await apiFetch('/machines', {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              machineModelId: model.id,
              serialNumber: row.serialNumber,
              machineCode: undefined,
              name: row.name || machineDefaultName(model),
              manufacturingDate: currentForm.manufacturingDate,
              warehouseImportDate: currentForm.warehouseImportDate,
              inventoryStatus: 'IN_STOCK',
              status: 'ACTIVE',
              accessories,
            }),
          ),
        });
      }

      return { count: rows.length, model };
    },
    onSuccess: async ({ count, model }) => {
      setSuccess(count > 1 ? `Đã thêm ${count} máy vào kho.` : 'Đã thêm sản phẩm vào kho.');
      setForm((current) => ({
        ...current,
        machineRows: '',
        manufacturingDate: '',
        warehouseImportDate: new Date().toISOString().slice(0, 10),
        accessoriesText: buildTemplateAccessoriesText(model),
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.modelDetail(model.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.addProductModels }),
      ]);
    },
  });

  const loading = modelsQuery.isLoading || modelsQuery.isFetching;
  const saving = createMachineMutation.isPending;
  const error = formError || (modelsQuery.error instanceof Error ? modelsQuery.error.message : '') || (createMachineMutation.error instanceof Error ? createMachineMutation.error.message : '');

  function updateField(field: keyof ProductForm, value: string) {
    setForm((current) => {
      if (field !== 'machineModelId') return { ...current, [field]: value };

      const nextModel = models.find((model) => model.id === value);
      if (nextModel?.businessLine?.id) {
        setSelectedProductId(nextModel.businessLine.id);
      }
      return {
        ...current,
        machineModelId: value,
        accessoriesText: nextModel ? buildTemplateAccessoriesText(nextModel) : '',
      };
    });
  }

  function selectProduct(productId: string) {
    const nextModel = models.find((model) => model.businessLine?.id === productId) ?? null;
    setSelectedProductId(productId);
    setForm((current) => ({
      ...current,
      machineModelId: nextModel?.id || '',
      accessoriesText: nextModel ? buildTemplateAccessoriesText(nextModel) : '',
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAddProduct) {
      setFormError('Bạn không có quyền thêm sản phẩm.');
      return;
    }

    if (!selectedModel) {
      setFormError('Vui lòng chọn model sản phẩm.');
      return;
    }

    const rows = machineRows;
    if (!rows.length) {
      setFormError('Vui lòng nhập ít nhất một serial máy.');
      return;
    }

    if (duplicatedSerial) {
      setFormError(`Serial ${duplicatedSerial} đang bị nhập trùng trong danh sách.`);
      return;
    }

    setFormError('');
    setSuccess('');

    try {
      await createMachineMutation.mutateAsync({ currentForm: form, model: selectedModel });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thêm được sản phẩm.');
    }
  }

  return (
    <PageFrame>
      <div className="overflow-hidden rounded-[22px] border border-[#dbe6f3] bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.38),transparent_30%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_54%,#f9fafb_100%)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Sản phẩm & Thiết bị</span>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#172033] md:text-4xl">Nhập máy vào kho</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748b]">
              Model, serial, phụ kiện.
            </p>
          </div>
          <button className="secondary-button bg-white/80" onClick={() => navigate('/product-catalog')} type="button">
            <ArrowLeft size={17} />
            Back
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_10px_22px_rgba(37,99,235,0.07)]">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Model</span>
            <strong className="mt-2 block truncate text-xl text-[#172033]">{selectedModel ? modelShortLabel(selectedModel) : 'Chưa chọn'}</strong>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_10px_22px_rgba(37,99,235,0.07)]">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Số máy</span>
            <strong className="mt-2 block text-3xl font-semibold tabular-nums text-[#172033]">{machineRows.length}</strong>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_10px_22px_rgba(37,99,235,0.07)]">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Trạng thái</span>
            <strong className="mt-2 inline-flex rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-sm font-semibold text-[#1d4ed8]">
              Sẵn sàng nhập kho
            </strong>
          </div>
        </div>
      </div>

      <div>
        {error ? <Notice message={error} /> : null}
        {success ? <div className="success-notice">{success}</div> : null}
      </div>

      <form className="grid min-w-0 gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
        <section className="grid min-w-0 gap-4">
          <div className="rounded-[20px] border border-[#dbe6f3] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
                <Layers3 size={19} />
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Bước 1</span>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#172033]">Chọn đúng model</h2>
              </div>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Sản phẩm
                <select
                  className="h-12 min-w-0 rounded-2xl border border-[#cbd5e1] bg-white px-4 text-[#172033] outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  disabled={loading}
                  onChange={(event) => selectProduct(event.target.value)}
                  required
                  value={selectedProductId}
                >
                  <option value="">Chọn sản phẩm</option>
                  {productOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Model
                <ModelSearchSelect
                  disabled={loading}
                  models={modelOptions}
                  onChange={(value) => updateField('machineModelId', value)}
                  value={form.machineModelId}
                />
              </label>
              <ModelInfoFields className="md:col-span-2" model={selectedModel} />
            </div>
          </div>

          <div className="rounded-[20px] border border-[#dbe6f3] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-[#ecfeff] text-[#0891b2]">
                  <Boxes size={19} />
                </span>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Bước 2</span>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#172033]">Nhập máy & phụ kiện</h2>
                </div>
              </div>
              <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">
                {machineRows.length} máy hợp lệ
              </span>
            </div>
            <div className="grid min-w-0 gap-4">
              <div className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                <span>Danh sách máy</span>
                <ProductMachineRowsEditor
                  accessoryMode={supportsEndoscopyChecklist ? 'endoscopy' : supportsProbes ? 'probe' : 'generic'}
                  defaultAccessoriesText={form.accessoriesText}
                  defaultMachineName={selectedModel ? machineDefaultName(selectedModel) : ''}
                  machinePreviewCode={machinePreviewCode}
                  onChange={(value) => updateField('machineRows', value)}
                  value={form.machineRows}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <DateInput label="Ngày sản xuất" onChange={(value) => updateField('manufacturingDate', value)} value={form.manufacturingDate} />
                <DateInput label="Ngày nhập kho" onChange={(value) => updateField('warehouseImportDate', value)} value={form.warehouseImportDate} />
              </div>
              {duplicatedSerial ? (
                <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#c2410c]">
                  Serial {duplicatedSerial} đang bị nhập trùng.
                </div>
              ) : null}
            </div>
          </div>

        </section>

        <aside className="grid min-w-0 gap-4 self-start min-[1180px]:sticky min-[1180px]:top-4">
          <div className="rounded-[22px] border border-[#dbe6f3] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
            <div className="grid min-h-44 place-items-center rounded-[20px] bg-[#f8fbff] p-4 text-center">
              <ModelImage large model={selectedModel ?? undefined} />
            </div>
            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Thông tin model</span>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{selectedModel ? modelShortLabel(selectedModel) : 'Chưa chọn model'}</h2>
              <div className="mt-4 grid gap-2 text-sm text-[#475569]">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2">
                  <span>Hãng</span>
                  <strong className="text-right text-[#172033]">{selectedModel?.manufacturer || '-'}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2">
                  <span>Xuất xứ</span>
                  <strong className="text-right text-[#172033]">{selectedModel ? modelOrigin(selectedModel) || '-' : '-'}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2">
                  <span>Kho</span>
                  <strong className="rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-xs text-[#15803d]">In stock</strong>
                </div>
              </div>
              {selectedModel && productNoteText(selectedModel) ? (
                <p className="mt-4 rounded-2xl bg-[#f8fafc] p-3 text-sm leading-6 text-[#64748b]">{productNoteText(selectedModel)}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#dbe6f3] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Preview</span>
                <h2 className="mt-1 text-lg font-semibold text-[#172033]">Máy sẽ tạo</h2>
              </div>
              <strong className="text-3xl font-semibold tabular-nums text-[#172033]">{machineRows.length}</strong>
            </div>
            <div className="mt-4 grid gap-2">
              {machineRows.length ? (
                machineRows.slice(0, 4).map((row, index) => (
                  <div className="rounded-2xl border border-[#e2e8f0] bg-[#fbfdff] px-3 py-2" key={`${row.serialNumber}-${index}`}>
                    <strong className="block truncate text-sm text-[#172033]">{row.serialNumber}</strong>
                    <span className="mt-0.5 block truncate text-xs font-medium text-[#64748b]">{row.machineCode || previewMachineCodeAt(machinePreviewCode, index) || 'Đang sinh mã máy'}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm font-medium leading-6 text-[#64748b]">
                  Dán serial ở ô bên trái, preview sẽ hiện tại đây.
                </div>
              )}
              {machineRows.length > 4 ? <span className="text-xs font-semibold text-[#64748b]">+{machineRows.length - 4} máy khác</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="secondary-button" onClick={() => navigate('/product-catalog')} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={saving || loading || !canAddProduct || !machineRows.length || Boolean(duplicatedSerial)} type="submit">
              {saving ? <Loader2 className="spin-icon" size={17} /> : <PackagePlus size={17} />}
              {saving ? 'Saving' : machineRows.length > 1 ? `Save ${machineRows.length} Products` : 'Save Product'}
            </button>
          </div>
        </aside>
      </form>
    </PageFrame>
  );
}

function ProductMachineRowsEditor({
  accessoryMode,
  defaultAccessoriesText,
  defaultMachineName,
  machinePreviewCode,
  value,
  onChange,
}: {
  accessoryMode: 'probe' | 'endoscopy' | 'generic';
  defaultAccessoriesText: string;
  defaultMachineName: string;
  machinePreviewCode: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const rows = parseProductMachineRowsForEditor(value);
  const makeEmptyRow = (): ProductMachineRow => ({ serialNumber: '', machineCode: '', name: defaultMachineName, accessoriesText: defaultAccessoriesText });
  const editableRows = rows.length ? rows : [makeEmptyRow()];

  function setRows(nextRows: ProductMachineRow[]) {
    onChange(serializeProductMachineRows(nextRows));
  }

  function updateRow(index: number, patch: Partial<ProductMachineRow>) {
    setRows(editableRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows([...editableRows, makeEmptyRow()]);
  }

  function removeRow(index: number) {
    const nextRows = editableRows.filter((_, rowIndex) => rowIndex !== index);
    setRows(nextRows.length ? nextRows : [makeEmptyRow()]);
  }

  function pasteBulk(rawValue: string) {
    const pastedRows = parseProductMachineRowsForEditor(rawValue)
      .filter((row) => row.serialNumber || row.machineCode || row.name)
      .map((row) => ({ ...row, name: row.name || defaultMachineName, accessoriesText: row.accessoriesText || defaultAccessoriesText }));
    if (!pastedRows.length) return;
    const activeRows = editableRows.filter((row) => row.serialNumber || row.machineCode || row.name);
    setRows([...activeRows, ...pastedRows]);
  }

  return (
    <div className="grid gap-3 rounded-[18px] border border-[#dbe6f3] bg-[#f8fbff] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Nhập từng máy</span>
        <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#172033] shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[#93c5fd] hover:text-[#1d4ed8]" onClick={addRow} type="button">
          <Plus size={15} />
          Thêm máy
        </button>
      </div>

      <div className="grid gap-3">
        {editableRows.map((row, index) => (
          <div className="grid gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.035)]" key={index}>
            <div className="grid gap-3 lg:grid-cols-[minmax(170px,1fr)_minmax(150px,0.8fr)_minmax(170px,1fr)_auto]">
              <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                Serial
                <input
                  className="h-11 rounded-xl border border-[#cbd5e1] bg-white px-3 text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  onChange={(event) => updateRow(index, { serialNumber: event.target.value })}
                  placeholder="AF3-2605-00012"
                  value={row.serialNumber}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                Mã máy
                <input
                  className="h-11 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-3 text-[#64748b] outline-none transition placeholder:text-[#94a3b8]"
                  disabled
                  placeholder="Đang sinh mã..."
                  value={row.machineCode || previewMachineCodeAt(machinePreviewCode, index) || 'Đang sinh mã...'}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                Tên máy / ghi chú
                <input
                  className="h-11 rounded-xl border border-[#cbd5e1] bg-white px-3 text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  onChange={(event) => updateRow(index, { name: event.target.value })}
                  placeholder="Có thể bỏ trống"
                  value={row.name}
                />
              </label>
              <button
                className="grid size-11 place-items-center self-end rounded-xl border border-[#fee2e2] bg-[#fff7f7] text-[#dc2626] transition hover:-translate-y-0.5 hover:bg-[#fee2e2]"
                disabled={editableRows.length === 1 && !row.serialNumber && !row.machineCode && !row.name}
                onClick={() => removeRow(index)}
                title="Xóa máy"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="rounded-2xl border border-[#e2e8f0] bg-[#fbfdff] p-3">
              <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Phụ kiện của máy này</span>
              {accessoryMode === 'generic' ? (
                <textarea
                  className="min-h-24 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  onChange={(event) => updateRow(index, { accessoriesText: event.target.value })}
                  placeholder={'Bộ dây nguồn | ACC-001\nCáp kết nối | ACC-002'}
                  value={formatMachineAccessoriesText(row.accessoriesText)}
                />
              ) : (
                <MachineAccessoryEditor
                  compact
                  mode={accessoryMode}
                  onChange={(nextAccessories) => updateRow(index, { accessoriesText: nextAccessories })}
                  value={row.accessoriesText || defaultAccessoriesText}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <details className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-[#475569]">Dán nhanh nhiều dòng</summary>
        <textarea
          className="mt-3 min-h-28 w-full rounded-xl border border-[#cbd5e1] bg-[#fbfdff] px-3 py-2 font-mono text-sm leading-6 text-[#172033] outline-none transition placeholder:font-sans placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
          onBlur={(event) => {
            pasteBulk(event.target.value);
            event.currentTarget.value = '';
          }}
          placeholder={'Mỗi dòng: Serial | Mã máy | Tên máy\nAF3-2605-00012 | MAY-00012\nAF3-2605-00013'}
        />
        <span className="mt-2 block text-xs font-medium leading-5 text-[#64748b]">Dán danh sách, rồi bấm ra ngoài.</span>
      </details>
    </div>
  );
}

function ProductModelTable({
  canAddProduct,
  catalogSearch,
  models,
  stockByModel,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  models: MachineModel[];
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
    <section className="overflow-hidden rounded-2xl border border-[#d8e0ea] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] bg-[#f8fafc] px-4 py-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748b]">Model máy</span>
          <h3 className="mt-1 text-lg font-semibold text-[#172033]">Danh sách model</h3>
        </div>
        <span className="rounded-full border border-[#dbe6f3] bg-white px-3 py-1 text-xs font-bold text-[#334155]">{models.length} model</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left">
          <thead className="bg-white text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">
            <tr className="border-b border-[#e4e4e7]">
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">Hãng</th>
              <th className="px-4 py-3">Kho</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedModels.map((model) => (
              <ModelRow
                canAddProduct={canAddProduct}
                catalogSearch={catalogSearch}
                key={model.id}
                model={model}
                stock={stockByModel[model.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ProductTablePager
        disabled={false}
        page={currentPage}
        pageSize={pageSize}
        total={models.length}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

function ProductTablePager({
  disabled,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  disabled: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e4e7] bg-[#f8fafc] px-4 py-3 text-sm font-medium text-[#64748b]">
      <span>{total ? `${first}-${last}/${total} model` : '0 model'}</span>
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

function ModelRow({
  canAddProduct,
  catalogSearch,
  model,
  stock,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  model: MachineModel;
  stock?: ModelStock;
}) {
  const navigate = useNavigate();
  const detailHref = `/business-lines/models/${model.id}${catalogSearch}`;

  return (
    <tr
      className="cursor-pointer border-b border-[#eeeeee] hover:bg-[#f4f4f5]"
      onClick={() => navigate(detailHref)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(detailHref);
        }
      }}
      tabIndex={0}
    >
      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-3 text-left">
          <ModelImage model={model} />
          <div className="min-w-0">
            <strong className="block text-sm text-[#1f1f1f]">{modelShortLabel(model)}</strong>
            <span className="block max-w-[340px] truncate text-[13px] text-[#666666]">{modelDetailLabel(model)}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-[#333333]">
        <span className="block font-semibold">{model.businessLine?.productIndustry?.name ?? 'Chưa phân ngành'}</span>
        <span className="text-[13px] text-[#666666]">{productCategoryLabel(model.productCategory ?? model.businessLine?.productCategory)}</span>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-[#333333]">{model.manufacturer || 'Chưa có hãng'}</td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">Còn kho {stock?.inStock ?? 0}</span>
          <span className="rounded-full border border-[#e5e5e5] bg-[#f4f7fb] px-2.5 py-1 text-[#333333]">Tổng {stock?.total ?? 0}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        {canAddProduct ? (
          <Link className="primary-button compact" onClick={(event) => event.stopPropagation()} to={`/business-lines/add-product?modelId=${model.id}`}>
            <PackagePlus size={16} />
            Add Product
          </Link>
        ) : (
          <span className="text-[13px] text-[#666666]">Chỉ xem</span>
        )}
      </td>
    </tr>
  );
}

function ModelSearchSelect({
  disabled,
  models,
  onChange,
  value,
}: {
  disabled: boolean;
  models: MachineModel[];
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedModel = models.find((model) => model.id === value) ?? null;
  const selectedLabel = selectedModel ? modelOptionLabel(selectedModel) : '';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(selectedLabel);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch(selectedLabel);
    }
  }, [open, selectedLabel]);

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword || keyword === selectedLabel.toLowerCase()) return models;

    return models.filter((model) =>
      [model.code, model.name, model.displayName, model.manufacturer, model.productLine, model.businessLine?.name, model.businessLine?.productIndustry?.name]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(keyword)),
    );
  }, [models, search, selectedLabel]);

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();
    const handleLayoutChange = () => updateDropdownPosition();
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [open, filteredModels.length]);

  function closeIfFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setOpen(false);
  }

  function updateDropdownPosition() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gap = 6;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, Math.min(288, openAbove ? spaceAbove - gap : spaceBelow - gap));

    setDropdownStyle({
      left: rect.left,
      top: openAbove ? rect.top - gap - maxHeight : rect.bottom + gap,
      width: rect.width,
      maxHeight,
    });
  }

  return (
    <div className="relative" onBlur={closeIfFocusLeaves} ref={wrapperRef}>
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] transition focus-within:border-[#18181b] focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]">
        <Search className="shrink-0 text-[#8a8a8a]" size={16} />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[#8a8a8a]"
          disabled={disabled}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
            window.requestAnimationFrame(updateDropdownPosition);
          }}
          onFocus={() => {
            setOpen(true);
            window.requestAnimationFrame(updateDropdownPosition);
          }}
          placeholder="Tìm mã model, tên model hoặc hãng"
          value={open ? search : selectedLabel}
        />
        {selectedModel ? (
          <button
            className="shrink-0 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 py-1 text-xs font-semibold text-[#666666] hover:border-[#e4e4e7] hover:text-[#18181b]"
            disabled={disabled}
            onClick={() => {
              onChange('');
              setSearch('');
              setOpen(true);
              window.requestAnimationFrame(updateDropdownPosition);
            }}
            type="button"
          >
            Đổi
          </button>
        ) : null}
      </div>
      {!value ? <input className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => null} /> : null}

      {open ? (
        <div className="fixed z-[80] overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_18px_42px_rgba(23,32,42,0.16)]" style={dropdownStyle}>
          <div className="overflow-y-auto p-1" style={{ maxHeight: dropdownStyle.maxHeight }}>
            {filteredModels.map((model) => {
              const active = model.id === value;
              return (
                <button
                  className={`grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-[#f4f4f5] text-[#18181b]' : 'text-[#1f1f1f] hover:bg-[#fafafa]'
                  }`}
                  key={model.id}
                  onClick={() => {
                    onChange(model.id);
                    setSearch(modelOptionLabel(model));
                    setOpen(false);
                  }}
                  type="button"
                >
                  <strong>{modelShortLabel(model)}</strong>
                </button>
              );
            })}
            {!filteredModels.length ? (
              <div className="rounded-md px-3 py-4 text-center text-sm font-medium text-[#666666]">
                Không có model phù hợp.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModelIndustryGroup({
  canAddProduct,
  catalogSearch,
  group,
  stockByModel,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  group: ModelIndustryGroupItem;
  stockByModel: Record<string, ModelStock>;
}) {
  const totalMachines = group.models.reduce((sum, model) => sum + (stockByModel[model.id]?.total ?? 0), 0);
  const inStock = group.models.reduce((sum, model) => sum + (stockByModel[model.id]?.inStock ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">{group.expertise || 'Ngành hàng'}</span>
          <h3 className="mt-1 text-xl font-semibold text-[#1f1f1f]">{group.name}</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-[#333333]">{group.models.length} model</span>
          <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{inStock}/{totalMachines} còn kho</span>
        </div>
      </div>

      <div className="divide-y divide-[#eeeeee]">
        {group.models.map((model) => (
          <ModelCard
            canAddProduct={canAddProduct}
            catalogSearch={catalogSearch}
            key={model.id}
            model={model}
            stock={stockByModel[model.id]}
          />
        ))}
      </div>
    </section>
  );
}

function ModelCard({
  canAddProduct,
  catalogSearch,
  model,
  stock,
}: {
  canAddProduct: boolean;
  catalogSearch: string;
  model: MachineModel;
  stock?: ModelStock;
}) {
  const navigate = useNavigate();
  const total = stock?.total ?? 0;
  const inStock = stock?.inStock ?? 0;
  const ratio = total ? Math.round((inStock / total) * 100) : 0;
  const detailHref = `/business-lines/models/${model.id}${catalogSearch}`;

  return (
    <article
      className="grid min-w-0 cursor-pointer gap-4 px-4 py-3 transition hover:bg-[#fafafa] min-[1120px]:grid-cols-[minmax(320px,1fr)_180px_220px_auto] min-[1120px]:items-center"
      onClick={() => navigate(detailHref)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(detailHref);
        }
      }}
      tabIndex={0}
    >
      <div className="flex min-w-0 gap-3">
        <ModelImage model={model} />
        <div className="min-w-0">
          <strong className="block truncate text-base font-semibold text-[#1f1f1f]">{modelShortLabel(model)}</strong>
          <span className="mt-1 block truncate text-sm leading-5 text-[#666666]">{modelDetailLabel(model)}</span>
          <span className="mt-1 block text-xs font-medium text-[#18181b]">{model.businessLine?.name || 'Chưa có dòng sản phẩm'}</span>
        </div>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="text-[12px] font-medium text-[#666666]">Hãng / loại</span>
        <strong className="truncate text-[#333333]">{model.manufacturer || 'Chưa có hãng'}</strong>
        <span className="truncate text-xs text-[#666666]">{[modelOrigin(model), productCategoryLabel(model.productCategory ?? model.businessLine?.productCategory)].filter(Boolean).join(' - ')}</span>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-[#666666]">Tồn kho</span>
          <strong className="tabular-nums text-[#1f1f1f]">{inStock}/{total}</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eeeeee]">
          <div className="h-full rounded-full bg-[#18181b]" style={{ width: `${Math.max(ratio, total ? 7 : 0)}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {canAddProduct ? (
          <Link className="primary-button compact" onClick={(event) => event.stopPropagation()} to={`/business-lines/add-product?modelId=${model.id}`}>
            <PackagePlus size={16} />
            Add Product
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ModelDetailBlock({
  canEditImage,
  detail,
  imageUrlDraft,
  loadingMachineDetail,
  loadingModelDetail,
  machineDetail,
  model,
  onImageUrlChange,
  onSaveImage,
  onSelectMachine,
  savingImage,
  selectedMachineId,
  stock,
}: {
  canEditImage: boolean;
  detail: MachineModelDetail | null;
  imageUrlDraft: string;
  loadingMachineDetail: boolean;
  loadingModelDetail: boolean;
  machineDetail: MachineDetail | null;
  model: MachineModel;
  onImageUrlChange: (value: string) => void;
  onSaveImage: () => void;
  onSelectMachine: (machineId: string) => void;
  savingImage: boolean;
  selectedMachineId: string;
  stock?: ModelStock;
}) {
  const machines = detail?.machines ?? [];
  const totalMachines = detail ? machines.length : stock?.total ?? 0;
  const warehouseQuantity = detail?.warehouseQuantity ?? stock?.inStock ?? 0;

  return (
    <div className="rounded-lg border border-[#e4e4e7] bg-white shadow-[0_18px_42px_rgba(23,32,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eeeeee] p-5">
        <div className="flex min-w-0 gap-4">
          <ModelImage large model={model} />
          <div className="min-w-0">
            <span className="text-xs font-medium text-[#666666]">Chi tiết model</span>
            <h3 className="mt-1 text-xl font-medium text-[#1f1f1f]">{modelShortLabel(model)}</h3>
            <p className="mt-1 text-sm text-[#666666]">{modelDetailLabel(model)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-[#177245]">{warehouseQuantity} máy còn kho</span>
              <span className="rounded-full border border-[#e5e5e5] bg-[#f4f7fb] px-2.5 py-1 text-[#333333]">{totalMachines} máy tổng</span>
              <span className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-[#333333]">{model.businessLine?.productIndustry?.name ?? 'Chưa phân ngành'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-5 min-[1320px]:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4 self-start">
          {canEditImage ? (
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                Ảnh model
                <input
                  className="h-10 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                  onChange={(event) => onImageUrlChange(event.target.value)}
                  placeholder="Dán URL ảnh model"
                  value={imageUrlDraft}
                />
              </label>
              <button className="primary-button compact mt-3" disabled={savingImage} onClick={onSaveImage} type="button">
                {savingImage ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
                {savingImage ? 'Saving' : 'Save'}
              </button>
            </div>
          ) : null}

          <div className="grid gap-2">
          <strong className="text-sm text-[#1f1f1f]">Danh sách serial</strong>

          <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
            {machines.map((machine) => (
              <button
                className={`rounded-lg border p-3 text-left ${
                  selectedMachineId === machine.id ? 'border-[#e4e4e7] bg-[#f4f4f5]' : 'border-[#e5e5e5] bg-[#fafafa] hover:border-[#18181b]'
                }`}
                key={machine.id}
                onClick={() => void onSelectMachine(machine.id)}
                type="button"
              >
                <strong className="block text-sm text-[#1f1f1f]">{machine.serialNumber}</strong>
                <span className="mt-1 block text-[13px] text-[#666666]">
                  {[machine.machineCode, inventoryLabel(machine.inventoryStatus), machine.customer?.name].filter(Boolean).join(' - ') || 'Chưa có thông tin thêm'}
                </span>
                <small className="mt-1 block text-xs text-[#666666]">{machine._count?.accessories ?? 0} phụ kiện</small>
              </button>
            ))}

            {!loadingModelDetail && machines.length === 0 ? <p className="rounded-lg bg-[#fafafa] p-4 text-sm text-[#666666]">Model này chưa có máy thực tế.</p> : null}
            {loadingModelDetail ? (
              <p className="rounded-lg bg-[#fafafa] p-4 text-sm font-semibold text-[#666666]">
                <Loader2 className="spin-icon mr-2 inline" size={16} />
                Đang tải máy
              </p>
            ) : null}
          </div>
          </div>
        </div>

        <MachineDetailPanel detail={machineDetail} loading={loadingMachineDetail} />
      </div>
    </div>
  );
}

function MachineDetailPanel({ detail, loading }: { detail: MachineDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="rounded-lg border border-[#e5e5e5] bg-white p-6 text-sm font-semibold text-[#666666]">
        <Loader2 className="spin-icon mr-2 inline" size={18} />
        Đang tải chi tiết máy
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="rounded-lg border border-[#e5e5e5] bg-white p-6 text-sm text-[#666666]">
        Chọn một serial máy để xem chi tiết máy và phụ kiện đi kèm.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#e5e5e5] bg-white">
      <div className="border-b border-[#eeeeee] p-4">
        <span className="text-xs font-medium text-[#666666]">Chi tiết máy</span>
        <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">{detail.name || detail.serialNumber}</h2>
        <p className="mt-1 text-sm text-[#666666]">{[detail.machineCode, detail.modelName, detail.manufacturer].filter(Boolean).join(' - ')}</p>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailItem label="Trạng thái kho" value={inventoryLabel(detail.inventoryStatus)} />
          <DetailItem label="Vận hành" value={statusLabel(detail.status)} />
          <DetailItem label="Ngày nhập kho" value={formatDate(detail.warehouseImportDate)} />
          <DetailItem label="Ngày lắp" value={formatDate(detail.installDate)} />
          <DetailItem label="Bắt đầu bảo hành" value={formatDate(detail.warrantyStartDate)} />
          <DetailItem label="Kết thúc bảo hành" value={formatDate(detail.warrantyEndDate)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <strong className="text-sm text-[#1f1f1f]">Phụ kiện</strong>
            <span className="text-xs font-medium text-[#666666]">{detail.accessories?.length ?? 0} phụ kiện</span>
          </div>
          <div className="grid gap-2">
            {detail.accessories?.map((accessory) => (
              <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3" key={accessory.id}>
                <strong className="block text-sm text-[#1f1f1f]">{accessory.name}</strong>
                <span className="mt-1 block text-[13px] text-[#666666]">
                  {[accessory.serialNumber, accessory.code].filter(Boolean).join(' - ') || 'Chưa có S/N'}
                </span>
                <small className="mt-1 block text-xs text-[#666666]">{accessory.componentAccessory?.component?.name || accessory.note || 'Phụ kiện theo máy'}</small>
              </div>
            ))}
            {!detail.accessories?.length ? <p className="rounded-lg bg-[#fafafa] p-4 text-sm text-[#666666]">Máy này chưa khai báo phụ kiện.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
      <span className="block text-xs font-medium text-[#666666]">{label}</span>
      <strong className="mt-1 block text-sm text-[#1f1f1f]">{value || 'Chưa có'}</strong>
    </div>
  );
}

function IndustryMachineChart({
  industries,
  stockByIndustry,
}: {
  industries: ProductIndustry[];
  stockByIndustry: Record<string, ModelStock>;
}) {
  const items = industries
    .map((industry) => ({
      id: industry.id,
      name: industry.name,
      stock: stockByIndustry[industry.id] ?? { inStock: 0, total: 0 },
    }))
    .sort((a, b) => b.stock.total - a.stock.total);
  const maxTotal = Math.max(1, ...items.map((item) => item.stock.total));

  return (
    <section className="grid gap-4 rounded-[22px] border border-white/80 bg-white/82 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_38px_rgba(24,24,27,0.08)] backdrop-blur md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium text-[#9f3340]">Biểu đồ ngành hàng</span>
          <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">Số lượng máy theo ngành</h2>
        </div>
        <BarChart3 className="text-[#18181b]" size={20} />
      </div>
      <div className="grid gap-4">
        {items.map((item) => {
          const width = Math.max(6, Math.round((item.stock.total / maxTotal) * 100));
          return (
            <div className="grid gap-1.5" key={item.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[#333333]">{item.name}</span>
                <span className="font-semibold tabular-nums text-[#1f1f1f]">{item.stock.total}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#f8dfe2]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#18181b] to-[#f05b63] transition-[width] duration-300" style={{ width: `${width}%` }} />
              </div>
              <span className="text-xs text-[#666666]">{item.stock.inStock} máy còn kho</span>
            </div>
          );
        })}
        {!items.length ? <p className="rounded-lg bg-[#fafafa] p-4 text-sm text-[#666666]">Chưa có ngành hàng để hiển thị biểu đồ.</p> : null}
      </div>
    </section>
  );
}

function IndustryStockCard({ icon, label, subLabel, value }: { icon: ReactNode; label: string; subLabel: string; value: number }) {
  return (
    <div className="grid gap-3 rounded-[18px] border border-white/80 bg-white/86 p-4 font-sans shadow-[0_8px_20px_rgba(24,24,27,0.05)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,24,27,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#667985]">{label}</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#18181b]">{icon}</span>
      </div>
      <div className="grid gap-1">
        <strong className="text-3xl font-semibold leading-none text-[#1f1f1f]">{value}</strong>
        <span className="text-xs font-medium text-[#7d666b]">{subLabel}</span>
      </div>
    </div>
  );
}

function IndustryOverviewRail({ items }: { items: Array<{ id: string; name: string; modelCount: number; stock: ModelStock }> }) {
  if (!items.length) {
    return <p className="rounded-2xl bg-white/70 p-4 text-sm text-[#667985]">Chưa có ngành hàng để tổng hợp.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 min-[1180px]:grid-cols-4">
      {items.slice(0, 4).map((item) => (
        <div className="rounded-2xl border border-white/80 bg-white/66 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" key={item.id}>
          <span className="block truncate text-sm font-semibold text-[#1f1f1f]">{item.name}</span>
          <span className="mt-1 block text-xs text-[#7d666b]">
            {item.modelCount} model · {item.stock.total} máy · {item.stock.inStock} còn kho
          </span>
        </div>
      ))}
    </div>
  );
}

function StockPill({ stock }: { stock: ModelStock }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[11px] font-medium">
      <span>{stock.total}</span>
      <span className="opacity-70">/ còn {stock.inStock}</span>
    </span>
  );
}

function industryTabClass(active: boolean) {
  return `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
    active ? 'border-[#18181b] bg-[#f4f4f5] text-[#18181b] shadow-[0_6px_18px_rgba(24,24,27,0.10)]' : 'border-[#e5e5e5] bg-[#fafafa] text-[#333333] hover:border-[#b8cbe1] hover:bg-white'
  }`;
}

function ModelImage({ model, large = false }: { model?: MachineModel | null; large?: boolean }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = model?.businessLine?.imageUrl;
  const sizeClass = large ? 'h-28 w-28' : 'h-12 w-12';

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  if (!imageUrl || hasError) {
    return (
      <span className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f4f7fb] text-[#8a8a8a]`}>
        <ImageOff size={large ? 28 : 18} />
      </span>
    );
  }

  return (
    <span className={`${sizeClass} block shrink-0 overflow-hidden rounded-lg border border-[#e5e5e5] bg-white`}>
      <img alt={model?.name ?? ''} className="h-full w-full object-cover" onError={() => setHasError(true)} src={imageUrl} />
    </span>
  );
}

function expertiseLabel(value?: ExpertiseGroup | null) {
  if (value === 'LAB_TESTING') return 'Xét nghiệm';
  if (value === 'IMAGING') return 'Chẩn đoán hình ảnh';
  if (value === 'PHYSIOTHERAPY') return 'VLTL';
  if (value === 'ICU') return 'ICU';
  return 'Chưa phân nhóm';
}

function productCategoryLabel(value?: string | null) {
  const labels: Record<string, string> = {
    ULTRASOUND: 'Siêu âm',
    LAB_TESTING: 'Xét nghiệm',
    BIOCHEMISTRY: 'Sinh hóa',
    IMMUNOLOGY: 'Miễn dịch',
    HEMATOLOGY: 'Huyết học',
    X_RAY: 'X-Quang',
    ENDOSCOPY: 'Nội soi',
    OTHER: 'Khác',
  };
  return value ? labels[value] ?? value : 'Chưa phân loại';
}

function inventoryLabel(value?: string | null) {
  const labels: Record<string, string> = {
    IN_STOCK: 'Trong kho',
    ACCESSORY_SPLIT: 'Tách phụ kiện',
    INSTALLED: 'Đã lắp',
    RESERVED: 'Đã giữ',
    RETURNED: 'Thu hồi',
    SOLD: 'Đã bán',
  };
  return value ? labels[value] ?? value : '';
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    ACTIVE: 'Đang hoạt động',
    MAINTENANCE: 'Bảo trì',
    REPAIRING: 'Đang sửa',
    INACTIVE: 'Ngừng hoạt động',
  };
  return value ? labels[value] ?? value : '';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function groupModelsByIndustry(models: MachineModel[]): ModelIndustryGroupItem[] {
  const groups = new Map<string, ModelIndustryGroupItem>();

  models.forEach((model) => {
    const industry = model.businessLine?.productIndustry;
    const id = industry?.id ?? '__unassigned__';
    const current = groups.get(id) ?? {
      id,
      name: industry?.name ?? 'Chưa phân ngành',
      expertise: expertiseLabel(industry?.expertiseGroup),
      models: [],
    };

    current.models.push(model);
    groups.set(id, current);
  });

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function buildIndustryOverviewItems(
  industries: ProductIndustry[],
  models: MachineModel[],
  stockByIndustry: Record<string, ModelStock>,
) {
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
      modelCount: modelCountByIndustry[industry.id] ?? 0,
      stock: stockByIndustry[industry.id] ?? { inStock: 0, total: 0 },
    }))
    .sort((first, second) => second.stock.total - first.stock.total || second.modelCount - first.modelCount);
}

function modelShortLabel(model: MachineModel) {
  return model.code || model.displayName || model.name;
}

function modelDetailLabel(model: MachineModel) {
  return [model.name, model.productLine, modelOrigin(model), model.businessLine?.name].filter(Boolean).join(' - ') || 'Chưa có mô tả model';
}

function modelOptionLabel(model: MachineModel) {
  return machineModelOptionLabel(model) || modelShortLabel(model);
}

function machineDefaultName(model: MachineModel) {
  return machineDisplayName(model) || modelShortLabel(model);
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

function modelOrigin(model: MachineModel) {
  return model.countryOfOrigin || model.businessLine?.countryOfOrigin || '';
}

function buildProductOptions(models: MachineModel[]) {
  const products = new Map<string, { id: string; name: string }>();

  for (const model of models) {
    const product = model.businessLine;
    if (!product?.id) continue;
    products.set(product.id, {
      id: product.id,
      name: product.name,
    });
  }

  return [...products.values()].sort((first, second) => first.name.localeCompare(second.name, 'vi'));
}

function productNoteText(model: MachineModel) {
  return [model.note, model.businessLine?.note].filter(Boolean).join('\n');
}

function emptyProductForm(machineModelId: string): ProductForm {
  return {
    machineModelId,
    machineRows: '',
    manufacturingDate: '',
    warehouseImportDate: new Date().toISOString().slice(0, 10),
    accessoriesText: '',
  };
}

function parseProductMachineRows(value: string): ProductMachineRow[] {
  return parseProductMachineRowsForEditor(value).filter((row) => row.serialNumber);
}

function parseProductMachineRowsForEditor(value: string): ProductMachineRow[] {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as ProductMachineRow[];
    if (Array.isArray(parsed)) {
      return parsed.map((row) => ({
        serialNumber: String(row?.serialNumber ?? '').trim(),
        machineCode: String(row?.machineCode ?? '').trim(),
        name: String(row?.name ?? '').trim(),
        accessoriesText: String(row?.accessoriesText ?? ''),
      }));
    }
  } catch {
    // Fall back to the legacy pasted text format below.
  }

  return value
    .split('\n')
    .map((line) => {
      const [serialNumber = '', machineCode = '', name = ''] = line.split(/[|\t]/).map((part) => part.trim());
      return {
        serialNumber,
        machineCode,
        name,
        accessoriesText: '',
      };
    });
}

function serializeProductMachineRows(rows: ProductMachineRow[]) {
  const normalizedRows = rows.map((row) => ({
    serialNumber: row.serialNumber.trim(),
    machineCode: row.machineCode.trim(),
    name: row.name.trim(),
    accessoriesText: row.accessoriesText,
  }));

  return normalizedRows.some((row) => row.serialNumber || row.machineCode || row.name || row.accessoriesText) ? JSON.stringify(normalizedRows) : '';
}

function findDuplicatedSerial(rows: ProductMachineRow[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.serialNumber.toLowerCase();
    if (seen.has(key)) return row.serialNumber;
    seen.add(key);
  }
  return '';
}

function previewMachineCodeAt(baseCode: string, index: number) {
  if (!baseCode) return '';
  const match = baseCode.match(/^(.*-)(\d+)$/);
  if (!match) return index === 0 ? baseCode : `${baseCode}-${String(index + 1).padStart(3, '0')}`;

  const [, prefix, numberText] = match;
  const nextNumber = Number(numberText) + index;
  return `${prefix}${String(nextNumber).padStart(numberText.length, '0')}`;
}

function flattenTemplateAccessories(model: MachineModel) {
  return (model.components ?? []).flatMap((component) =>
    (component.accessories ?? []).map((accessory) => ({
      ...accessory,
      componentName: component.name,
    })),
  );
}

function buildTemplateAccessoriesText(model: MachineModel) {
  return serializeMachineAccessories(
    flattenTemplateAccessories(model).map((accessory) => ({
      componentAccessoryId: accessory.id,
      code: accessory.code,
      name: accessory.code || accessory.name,
      serialNumber: '',
    })),
  );
}

function parseTemplateAccessoryLines(value: string, model: MachineModel) {
  const templateAccessories = flattenTemplateAccessories(model);
  const parsed = parseMachineAccessoriesInput(value);

  return parsed.map((item) => {
    const template = templateAccessories.find((accessory) => accessory.code === item.code || accessory.id === item.componentAccessoryId);

    if (!template) return item;

    return {
      componentAccessoryId: template.id,
      code: template.code,
      name: template.code || template.name,
      serialNumber: item.serialNumber,
    };
  });
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function buildCatalogSearch(industryId: string, query: string) {
  const params = new URLSearchParams();
  if (industryId && industryId !== allIndustriesKey) params.set('industry', industryId);
  if (query.trim()) params.set('q', query.trim());
  const value = params.toString();
  return value ? `?${value}` : '';
}
