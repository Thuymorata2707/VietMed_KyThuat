import { ArrowLeft, BarChart3, Boxes, ImageOff, Layers3, Loader2, PackagePlus, Plus, RefreshCw, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FocusEvent, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
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
  machineCode: string;
  serialNumber: string;
  warehouseImportDate: string;
  accessoriesText: string;
};

const allIndustriesKey = 'all';

export function ProductCatalogPage({ user }: { user: ApiUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [industries, setIndustries] = useState<ProductIndustry[]>([]);
  const [models, setModels] = useState<MachineModel[]>([]);
  const [stockByModel, setStockByModel] = useState<Record<string, ModelStock>>({});
  const [selectedIndustryId, setSelectedIndustryId] = useState(searchParams.get('industry') || allIndustriesKey);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';

  useEffect(() => {
    void loadData();
  }, []);

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

  const visibleModelGroups = useMemo(() => groupModelsByIndustry(visibleModels), [visibleModels]);

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

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [industryResult, nextModels] = await Promise.all([
        apiFetch<Paginated<ProductIndustry>>('/product-industries?limit=100'),
        apiFetchAllPages<MachineModel>('/machine-models'),
      ]);
      const nextIndustries = industryResult.data ?? [];

      setIndustries(nextIndustries);
      setModels(nextModels);
      await loadMachineStock(nextModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMachineStock(nextModels: MachineModel[]) {
    const allowedModelIds = new Set(nextModels.map((model) => model.id));
    const machines = await fetchAllCatalogMachines();
    const nextStock = nextModels.reduce<Record<string, ModelStock>>((stock, model) => {
      stock[model.id] = { inStock: 0, total: 0 };
      return stock;
    }, {});

    machines.forEach((machine) => {
      if (!machine.machineModelId || !allowedModelIds.has(machine.machineModelId)) return;
      const current = nextStock[machine.machineModelId] ?? { inStock: 0, total: 0 };
      current.total += 1;
      if (machine.inventoryStatus === 'IN_STOCK') current.inStock += 1;
      nextStock[machine.machineModelId] = current;
    });

    setStockByModel(nextStock);
  }

  async function fetchAllCatalogMachines() {
    return apiFetchAllPages<CatalogMachine>('/machines');
  }

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
          description="Model sản phẩm mặc định được hiển thị theo ngành hàng. Add sản phẩm dùng để nhập serial máy thực tế vào kho."
        />
        <div className="flex flex-wrap justify-end gap-2">
          {canAddProduct ? (
            <Link className="primary-button" to="/business-lines/add-product">
              <Plus size={17} />
              Add sản phẩm
            </Link>
          ) : null}
          <button className="secondary-button" disabled={loading} onClick={() => void loadData()} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Tải lại
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}

      <section className="grid overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_18px_44px_rgba(47,95,152,0.10)] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-between gap-6 bg-[#f7fafc] p-5 md:p-6">
          <div>
            <span className="inline-flex min-h-8 items-center rounded-lg border border-[#d8e0ea] bg-white px-2.5 text-xs font-semibold text-[#d71920]">
              Catalog overview
            </span>
            <h2 className="mt-4 max-w-2xl text-[clamp(24px,3vw,38px)] font-semibold leading-tight text-[#1f1f1f]">
              Danh mục sản phẩm theo ngành hàng
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666666]">
              Theo dõi model cố định, số máy thực tế và tình trạng còn kho trong cùng một màn.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <IndustryStockCard icon={<Boxes size={18} />} label="Tổng máy" value={catalogTotals.machines} subLabel={`${catalogTotals.inStock} còn kho`} />
            <IndustryStockCard icon={<Layers3 size={18} />} label="Model" value={catalogTotals.models} subLabel={`${catalogTotals.businessLines} dòng`} />
            <IndustryStockCard icon={<BarChart3 size={18} />} label="Đang xem" value={visibleModels.length} subLabel="model sau lọc" />
          </div>
        </div>
        <IndustryMachineChart industries={visibleIndustries} stockByIndustry={stockByIndustry} />
      </section>

      <section className="grid gap-4">
        <div className="sticky top-0 z-10 grid gap-3 rounded-lg border border-[#d8e0ea] bg-white/95 p-3 shadow-[0_10px_30px_rgba(20,32,51,0.06)] backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
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
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-[#fafafa] px-3 text-[#666666] focus-within:border-[#d71920] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]">
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
          <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fbfdff] p-8 text-center text-sm font-semibold text-[#666666]">
            <Loader2 className="spin-icon mx-auto mb-2" size={20} />
            Đang tải danh sách sản phẩm
          </div>
        ) : null}

        {!loading && visibleModels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fbfdff] p-8 text-center text-sm text-[#666666]">
            Không có model phù hợp với bộ lọc.
          </div>
        ) : null}

        {!loading && visibleModelGroups.map((group) => (
          <ModelIndustryGroup
            canAddProduct={canAddProduct}
            catalogSearch={catalogSearch}
            group={group}
            key={group.id}
            stockByModel={stockByModel}
          />
        ))}
      </section>

    </PageFrame>
  );
}

export function ProductModelDetailPage({ user }: { user: ApiUser }) {
  const navigate = useNavigate();
  const { modelId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<MachineModelDetail | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedMachineDetail, setSelectedMachineDetail] = useState<MachineDetail | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [loadingModelDetail, setLoadingModelDetail] = useState(true);
  const [loadingMachineDetail, setLoadingMachineDetail] = useState(false);
  const [savingModelImage, setSavingModelImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const canEditModelImage = role === 'admin';
  const backToCatalogHref = `/business-lines${buildCatalogSearch(searchParams.get('industry') || allIndustriesKey, searchParams.get('q') || '')}`;

  useEffect(() => {
    void loadModelDetail();
  }, [modelId]);

  async function loadModelDetail() {
    if (!modelId) return;

    setLoadingModelDetail(true);
    setError('');
    setSuccess('');
    setSelectedMachineId('');
    setSelectedMachineDetail(null);

    try {
      const result = await apiFetch<MachineModelDetail>(`/machine-models/${modelId}`);
      if (role === 'engineer' && userExpertise && result.businessLine?.productIndustry?.expertiseGroup !== userExpertise) {
        setDetail(null);
        setError('Bạn không có quyền xem model của ngành hàng này.');
        return;
      }

      setDetail(result);
      setImageUrlDraft(result.businessLine?.imageUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết model.');
    } finally {
      setLoadingModelDetail(false);
    }
  }

  async function selectMachine(machineId: string) {
    setSelectedMachineId(machineId);
    setLoadingMachineDetail(true);
    setError('');
    setSuccess('');

    try {
      const machine = await apiFetch<MachineDetail>(`/machines/${machineId}`);
      setSelectedMachineDetail(machine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết máy.');
    } finally {
      setLoadingMachineDetail(false);
    }
  }

  async function saveModelImage() {
    const businessLineId = detail?.businessLine?.id;

    if (!businessLineId) {
      setError('Model này chưa gắn nhóm sản phẩm để cập nhật ảnh.');
      return;
    }

    setSavingModelImage(true);
    setError('');
    setSuccess('');

    try {
      const updatedBusinessLine = await apiFetch<BusinessLine>(`/business-lines/${businessLineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrl: imageUrlDraft.trim() || null }),
      });

      setDetail((current) =>
        current
          ? {
              ...current,
              businessLine: current.businessLine ? { ...current.businessLine, imageUrl: updatedBusinessLine.imageUrl ?? null } : current.businessLine,
            }
          : current,
      );
      setImageUrlDraft(updatedBusinessLine.imageUrl ?? '');
      setSuccess('Đã cập nhật ảnh model.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được ảnh model.');
    } finally {
      setSavingModelImage(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Sản phẩm & Thiết bị"
          title={detail ? modelShortLabel(detail) : 'Chi tiết model'}
          description="Xem toàn bộ máy thực tế thuộc model, chi tiết từng máy và phụ kiện đi kèm."
        />
        <div className="flex flex-wrap justify-end gap-2">
          {detail && canAddProduct ? (
            <Link className="primary-button" to={`/business-lines/add-product?modelId=${detail.id}`}>
              <PackagePlus size={17} />
              Add sản phẩm
            </Link>
          ) : null}
          <button className="secondary-button" onClick={() => navigate(backToCatalogHref)} type="button">
            <ArrowLeft size={17} />
            Quay lại danh sách
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
          onSelectMachine={selectMachine}
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
  const [models, setModels] = useState<MachineModel[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyProductForm(searchParams.get('modelId') ?? ''));
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const selectedModel = models.find((model) => model.id === form.machineModelId) ?? null;
  const productOptions = useMemo(() => buildProductOptions(models), [models]);
  const modelOptions = useMemo(
    () => models.filter((model) => !selectedProductId || model.businessLine?.id === selectedProductId),
    [models, selectedProductId],
  );
  const supportsProbes = isUltrasoundMachineModel(selectedModel);
  const supportsEndoscopyChecklist = isEndoscopyMachineModel(selectedModel);

  useEffect(() => {
    void loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    setError('');

    try {
      const allModels = await apiFetchAllPages<MachineModel>('/machine-models');
      const nextModels = allModels.filter(
        (model) => role !== 'engineer' || !userExpertise || model.businessLine?.productIndustry?.expertiseGroup === userExpertise,
      );
      const requestedModelId = searchParams.get('modelId') ?? '';
      const nextModelId = requestedModelId || nextModels[0]?.id || '';
      const nextModel = nextModels.find((model) => model.id === nextModelId) ?? nextModels[0];

      setModels(nextModels);
      setSelectedProductId(nextModel?.businessLine?.id || '');
      setForm((current) => ({
        ...current,
        machineModelId: nextModel?.id || '',
        accessoriesText: nextModel ? buildTemplateAccessoriesText(nextModel) : '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được model sản phẩm.');
    } finally {
      setLoading(false);
    }
  }

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
      setError('Bạn không có quyền thêm sản phẩm.');
      return;
    }

    if (!selectedModel) {
      setError('Vui lòng chọn model sản phẩm.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch('/machines', {
        method: 'POST',
        body: JSON.stringify(
          compactPayload({
            machineModelId: selectedModel.id,
            serialNumber: form.serialNumber.trim(),
            machineCode: form.machineCode.trim(),
            warehouseImportDate: form.warehouseImportDate,
            inventoryStatus: 'IN_STOCK',
            status: 'ACTIVE',
            accessories: parseTemplateAccessoryLines(form.accessoriesText, selectedModel),
          }),
        ),
      });

      setSuccess('Đã thêm sản phẩm vào kho.');
      setForm({
        ...emptyProductForm(selectedModel.id),
        accessoriesText: buildTemplateAccessoriesText(selectedModel),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được sản phẩm.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Sản phẩm & Thiết bị"
          title="Add sản phẩm"
          description="Chọn model mặc định có sẵn, nhập serial máy thực tế và phụ kiện đi kèm để đưa vào kho."
        />
        <button className="secondary-button" onClick={() => navigate('/business-lines')} type="button">
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <form className="grid min-w-0 gap-4 min-[1320px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
        <section className="grid min-w-0 gap-4">
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-[#1f1f1f]">Thông tin sản phẩm</h2>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Sản phẩm
                <select
                  className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
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
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Model
                <ModelSearchSelect
                  disabled={loading}
                  models={modelOptions}
                  onChange={(value) => updateField('machineModelId', value)}
                  value={form.machineModelId}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Hãng sản xuất
                <input className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none" readOnly value={selectedModel?.manufacturer ?? ''} />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Xuất xứ
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none"
                  readOnly
                  value={selectedModel?.businessLine?.countryOfOrigin ?? ''}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333] md:col-span-2">
                Ghi chú sản phẩm / quy cách
                <textarea
                  className="min-h-24 min-w-0 rounded-lg border border-[#d6d6d6] bg-[#fafafa] px-3 py-2 text-[#1f1f1f] outline-none"
                  readOnly
                  value={selectedModel ? productNoteText(selectedModel) : ''}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Serial Number
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => updateField('serialNumber', event.target.value)}
                  required
                  value={form.serialNumber}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Mã máy nội bộ (tự sinh nếu để trống)
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => updateField('machineCode', event.target.value)}
                  placeholder="VD: XCUBE50-001"
                  value={form.machineCode}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                Ngày nhập kho
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => updateField('warehouseImportDate', event.target.value)}
                  type="date"
                  value={form.warehouseImportDate}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-[#1f1f1f]">Phụ kiện đi kèm</h2>
            </div>
            {supportsProbes || supportsEndoscopyChecklist ? (
              <MachineAccessoryEditor
                mode={supportsEndoscopyChecklist ? 'endoscopy' : 'probe'}
                onChange={(value) => updateField('accessoriesText', value)}
                value={form.accessoriesText}
              />
            ) : (
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#333333]">
                S/N phụ kiện
                <textarea
                  className="min-h-36 min-w-0 rounded-lg border border-[#d6d6d6] px-3 py-2 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => updateField('accessoriesText', event.target.value)}
                  placeholder={'Mỗi dòng: Phụ kiện | Serial Number\nVí dụ:\nBộ dây nguồn | ACC-001\nCáp kết nối | ACC-002'}
                  value={formatMachineAccessoriesText(form.accessoriesText)}
                />
              </label>
            )}
          </div>
        </section>

        <aside className="grid min-w-0 gap-4 self-start">
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-[#1f1f1f]">Products Images</h2>
            <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#d6d6d6] bg-[#fafafa] p-4 text-center text-sm text-[#666666]">
              <ModelImage large model={selectedModel ?? undefined} />
              <span className="mt-3 block">{selectedModel?.businessLine?.name ?? 'Chọn model để xem hình nhóm sản phẩm'}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-[#1f1f1f]">Pricing & Availability</h2>
            <div className="grid gap-3 text-sm text-[#333333]">
              <div className="flex items-center justify-between gap-3">
                <span>Availability Status</span>
                <strong className="rounded-full border border-[#b9e8ca] bg-[#eefaf3] px-2.5 py-1 text-xs text-[#177245]">In Stock</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Model</span>
                <strong>{selectedModel ? modelShortLabel(selectedModel) : 'Chưa chọn'}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="secondary-button" onClick={() => navigate('/business-lines')} type="button">
              Draft
            </button>
            <button className="primary-button" disabled={saving || loading || !canAddProduct} type="submit">
              {saving ? <Loader2 className="spin-icon" size={17} /> : <PackagePlus size={17} />}
              Publish Product
            </button>
          </div>
        </aside>
      </form>
    </PageFrame>
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
  return (
    <tr className="border-b border-[#eeeeee] hover:bg-[#fff8f7]">
      <td className="px-4 py-4">
        <Link className="flex min-w-0 items-center gap-3 text-left" to={`/business-lines/models/${model.id}${catalogSearch}`}>
          <ModelImage model={model} />
          <div className="min-w-0">
            <strong className="block text-sm text-[#1f1f1f]">{modelShortLabel(model)}</strong>
            <span className="block max-w-[340px] truncate text-[13px] text-[#666666]">{modelDetailLabel(model)}</span>
          </div>
        </Link>
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
          <Link className="primary-button compact" to={`/business-lines/add-product?modelId=${model.id}`}>
            <PackagePlus size={16} />
            Add sản phẩm
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

  function closeIfFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setOpen(false);
  }

  return (
    <div className="relative" onBlur={closeIfFocusLeaves}>
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] transition focus-within:border-[#d71920] focus-within:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]">
        <Search className="shrink-0 text-[#8a8a8a]" size={16} />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[#8a8a8a]"
          disabled={disabled}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm mã model, tên model hoặc hãng"
          value={open ? search : selectedLabel}
        />
        {selectedModel ? (
          <button
            className="shrink-0 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 py-1 text-xs font-semibold text-[#666666] hover:border-[#f5c7cb] hover:text-[#d71920]"
            disabled={disabled}
            onClick={() => {
              onChange('');
              setSearch('');
              setOpen(true);
            }}
            type="button"
          >
            Đổi
          </button>
        ) : null}
      </div>
      {!value ? <input className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => null} /> : null}

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_18px_42px_rgba(23,32,42,0.16)]">
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredModels.map((model) => {
              const active = model.id === value;
              return (
                <button
                  className={`grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-[#fff5f5] text-[#d71920]' : 'text-[#1f1f1f] hover:bg-[#fbfdff]'
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
                  <span className="text-xs text-[#666666]">{modelDetailLabel(model)}</span>
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
    <section className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
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
  const total = stock?.total ?? 0;
  const inStock = stock?.inStock ?? 0;
  const ratio = total ? Math.round((inStock / total) * 100) : 0;

  return (
    <article className="grid min-w-0 gap-4 px-4 py-3 transition hover:bg-[#fbfdff] min-[1120px]:grid-cols-[minmax(320px,1fr)_180px_220px_auto] min-[1120px]:items-center">
      <Link className="flex min-w-0 gap-3" to={`/business-lines/models/${model.id}${catalogSearch}`}>
        <ModelImage model={model} />
        <div className="min-w-0">
          <strong className="block truncate text-base font-semibold text-[#1f1f1f]">{modelShortLabel(model)}</strong>
          <span className="mt-1 block truncate text-sm leading-5 text-[#666666]">{modelDetailLabel(model)}</span>
          <span className="mt-1 block text-xs font-medium text-[#d71920]">{model.businessLine?.name || 'Chưa có dòng sản phẩm'}</span>
        </div>
      </Link>

      <div className="grid gap-1 text-sm">
        <span className="text-[12px] font-medium text-[#666666]">Hãng / loại</span>
        <strong className="truncate text-[#333333]">{model.manufacturer || 'Chưa có hãng'}</strong>
        <span className="truncate text-xs text-[#666666]">{productCategoryLabel(model.productCategory ?? model.businessLine?.productCategory)}</span>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-[#666666]">Tồn kho</span>
          <strong className="tabular-nums text-[#1f1f1f]">{inStock}/{total}</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eeeeee]">
          <div className="h-full rounded-full bg-[#d71920]" style={{ width: `${Math.max(ratio, total ? 7 : 0)}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link className="secondary-button compact" to={`/business-lines/models/${model.id}${catalogSearch}`}>
          Xem
        </Link>
        {canAddProduct ? (
          <Link className="primary-button compact" to={`/business-lines/add-product?modelId=${model.id}`}>
            <PackagePlus size={16} />
            Add
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
    <div className="rounded-lg border border-[#f5c7cb] bg-white shadow-[0_18px_42px_rgba(23,32,42,0.08)]">
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
                  className="h-10 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => onImageUrlChange(event.target.value)}
                  placeholder="Dán URL ảnh model"
                  value={imageUrlDraft}
                />
              </label>
              <button className="primary-button compact mt-3" disabled={savingImage} onClick={onSaveImage} type="button">
                {savingImage ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
                Lưu ảnh
              </button>
            </div>
          ) : null}

          <div className="grid gap-2">
          <strong className="text-sm text-[#1f1f1f]">Danh sách serial</strong>

          <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
            {machines.map((machine) => (
              <button
                className={`rounded-lg border p-3 text-left ${
                  selectedMachineId === machine.id ? 'border-[#f5c7cb] bg-[#fff8f7]' : 'border-[#e5e5e5] bg-[#fafafa] hover:border-[#d71920]'
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
        <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">{detail.serialNumber}</h2>
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
    <section className="grid gap-4 border-l border-[#d8e0ea] bg-white p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium text-[#666666]">Biểu đồ ngành hàng</span>
          <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">Số lượng máy theo ngành</h2>
        </div>
        <BarChart3 className="text-[#d71920]" size={20} />
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
              <div className="h-2.5 overflow-hidden rounded-full bg-[#eeeeee]">
                <div className="h-full rounded-full bg-[#d71920] transition-[width] duration-300" style={{ width: `${width}%` }} />
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
    <div className="grid gap-3 rounded-lg border border-[#d8e0ea] bg-white p-4 font-sans shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#666666]">{label}</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef6ff] text-[#d71920]">{icon}</span>
      </div>
      <div className="grid gap-1">
        <strong className="text-3xl font-semibold leading-none text-[#1f1f1f]">{value}</strong>
        <span className="text-xs font-medium text-[#666666]">{subLabel}</span>
      </div>
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
    active ? 'border-[#d71920] bg-[#fff5f5] text-[#d71920] shadow-[0_6px_18px_rgba(215,25,32,0.10)]' : 'border-[#e5e5e5] bg-[#fafafa] text-[#333333] hover:border-[#b8cbe1] hover:bg-white'
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

function modelShortLabel(model: MachineModel) {
  return model.code || model.displayName || model.name;
}

function modelDetailLabel(model: MachineModel) {
  return [model.name, model.productLine, model.businessLine?.name].filter(Boolean).join(' - ') || 'Chưa có mô tả model';
}

function modelOptionLabel(model: MachineModel) {
  return modelShortLabel(model);
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
  return [
    model.note,
    model.description,
    model.businessLine?.note ? `Ghi chú dòng sản phẩm: ${model.businessLine.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function emptyProductForm(machineModelId: string): ProductForm {
  return {
    machineModelId,
    machineCode: '',
    serialNumber: '',
    warehouseImportDate: new Date().toISOString().slice(0, 10),
    accessoriesText: '',
  };
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
