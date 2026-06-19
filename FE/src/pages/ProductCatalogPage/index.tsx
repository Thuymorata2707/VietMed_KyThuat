import { ArrowLeft, ImageOff, Loader2, PackagePlus, Plus, RefreshCw, Save, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { getRoleName } from '../../auth/roles';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { formatMachineAccessoriesText, parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';

type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING';

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

type MachineItem = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  inventoryStatus?: string | null;
  status?: string | null;
  customer?: { id: string; name: string } | null;
  _count?: { accessories?: number };
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

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [industryResult, modelResult] = await Promise.all([
        apiFetch<Paginated<ProductIndustry>>('/product-industries?limit=100'),
        apiFetch<Paginated<MachineModel>>('/machine-models?limit=100'),
      ]);
      const nextIndustries = industryResult.data ?? [];
      const nextModels = modelResult.data ?? [];

      setIndustries(nextIndustries);
      setModels(nextModels);
      await loadModelStock(nextModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }

  async function loadModelStock(nextModels: MachineModel[]) {
    const entries = await Promise.all(
      nextModels.map(async (model) => {
        const [inStockResult, totalResult] = await Promise.all([
          apiFetch<Paginated<unknown>>(`/machines?machineModelId=${model.id}&inventoryStatus=IN_STOCK&limit=1`),
          apiFetch<Paginated<unknown>>(`/machines?machineModelId=${model.id}&limit=1`),
        ]);

        return [model.id, { inStock: inStockResult.meta.total, total: totalResult.meta.total }] as const;
      }),
    );

    setStockByModel(Object.fromEntries(entries));
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IndustryStockCard label="Tất cả ngành hàng" stock={visibleIndustryStock} />
        {visibleIndustries.slice(0, 3).map((industry) => (
          <IndustryStockCard key={industry.id} label={industry.name} stock={stockByIndustry[industry.id] ?? { inStock: 0, total: 0 }} />
        ))}
      </section>

      <section className="rounded-lg border border-[#dde5ee] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] p-3.5">
          <div className="flex flex-wrap gap-2">
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
          <label className="flex h-10 min-w-60 flex-[1_1_320px] items-center gap-2 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#667085] focus-within:border-[#d92d20] focus-within:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]">
            <Search size={16} />
            <input
              className="min-w-0 flex-1 border-0 text-[#101828] outline-none"
              onChange={(event) => updateCatalogState(selectedIndustryId, event.target.value)}
              placeholder="Tìm model, hãng, nhóm sản phẩm"
              value={query}
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full border-collapse">
            <thead>
              <tr className="border-b border-[#edf2f7] bg-[#f8fafc] text-left text-xs font-medium text-[#667085]">
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleModels.map((model) => (
                <ModelRow
                  canAddProduct={canAddProduct}
                  catalogSearch={catalogSearch}
                  key={model.id}
                  model={model}
                  stock={stockByModel[model.id]}
                />
              ))}

              {loading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm font-semibold text-[#667085]" colSpan={5}>
                    <Loader2 className="spin-icon mx-auto mb-2" size={20} />
                    Đang tải danh sách sản phẩm
                  </td>
                </tr>
              ) : null}

              {!loading && visibleModels.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-[#667085]" colSpan={5}>
                    Không có model phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
        <section className="rounded-lg border border-[#dde5ee] bg-white p-6 text-sm font-semibold text-[#667085]">
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;
  const canAddProduct = role === 'admin' || role === 'engineer';
  const selectedModel = models.find((model) => model.id === form.machineModelId) ?? null;
  const supportsProbes = isUltrasoundMachineModel(selectedModel);

  useEffect(() => {
    void loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<Paginated<MachineModel>>('/machine-models?limit=100');
      const nextModels = (result.data ?? []).filter(
        (model) => role !== 'engineer' || !userExpertise || model.businessLine?.productIndustry?.expertiseGroup === userExpertise,
      );
      const requestedModelId = searchParams.get('modelId') ?? '';
      const nextModelId = requestedModelId || nextModels[0]?.id || '';
      const nextModel = nextModels.find((model) => model.id === nextModelId) ?? nextModels[0];

      setModels(nextModels);
      setForm((current) => ({
        ...current,
        machineModelId: nextModelId,
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
      return {
        ...current,
        machineModelId: value,
        accessoriesText: nextModel ? buildTemplateAccessoriesText(nextModel) : '',
      };
    });
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
          <div className="rounded-lg border border-[#dde5ee] bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-[#101828]">Products Description</h2>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054] md:col-span-2">
                Model sản phẩm
                <select
                  className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
                  disabled={loading}
                  onChange={(event) => updateField('machineModelId', event.target.value)}
                  required
                  value={form.machineModelId}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {modelOptionLabel(model)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                Category
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none"
                  readOnly
                  value={selectedModel?.businessLine?.productIndustry?.name ?? ''}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                Brand
                <input className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none" readOnly value={selectedModel?.manufacturer ?? ''} />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                Serial Number
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
                  onChange={(event) => updateField('serialNumber', event.target.value)}
                  required
                  value={form.serialNumber}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                Mã máy nội bộ
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
                  onChange={(event) => updateField('machineCode', event.target.value)}
                  value={form.machineCode}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                Ngày nhập kho
                <input
                  className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
                  onChange={(event) => updateField('warehouseImportDate', event.target.value)}
                  type="date"
                  value={form.warehouseImportDate}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-[#dde5ee] bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-[#101828]">Phụ kiện đi kèm</h2>
            </div>
            {supportsProbes ? (
              <MachineAccessoryEditor onChange={(value) => updateField('accessoriesText', value)} value={form.accessoriesText} />
            ) : (
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
                S/N phụ kiện
                <textarea
                  className="min-h-36 min-w-0 rounded-lg border border-[#cfd8e3] px-3 py-2 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
                  onChange={(event) => updateField('accessoriesText', event.target.value)}
                  placeholder={'Mỗi dòng: Phụ kiện | Serial Number\nVí dụ:\nBộ dây nguồn | ACC-001\nCáp kết nối | ACC-002'}
                  value={formatMachineAccessoriesText(form.accessoriesText)}
                />
              </label>
            )}
          </div>
        </section>

        <aside className="grid min-w-0 gap-4 self-start">
          <div className="rounded-lg border border-[#dde5ee] bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-[#101828]">Products Images</h2>
            <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#cfd8e3] bg-[#f8fafc] p-4 text-center text-sm text-[#667085]">
              <ModelImage large model={selectedModel ?? undefined} />
              <span className="mt-3 block">{selectedModel?.businessLine?.name ?? 'Chọn model để xem hình nhóm sản phẩm'}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#dde5ee] bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-[#101828]">Pricing & Availability</h2>
            <div className="grid gap-3 text-sm text-[#344054]">
              <div className="flex items-center justify-between gap-3">
                <span>Availability Status</span>
                <strong className="rounded-full border border-[#abefc6] bg-[#ecfdf3] px-2.5 py-1 text-xs text-[#067647]">In Stock</strong>
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
    <tr className="border-b border-[#edf2f7] hover:bg-[#fff8f7]">
      <td className="px-4 py-4">
        <Link className="flex min-w-0 items-center gap-3 text-left" to={`/business-lines/models/${model.id}${catalogSearch}`}>
          <ModelImage model={model} />
          <div className="min-w-0">
            <strong className="block text-sm text-[#101828]">{modelShortLabel(model)}</strong>
            <span className="block max-w-[340px] truncate text-[13px] text-[#667085]">{modelDetailLabel(model)}</span>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4 text-sm text-[#344054]">
        <span className="block font-semibold">{model.businessLine?.productIndustry?.name ?? 'Chưa phân ngành'}</span>
        <span className="text-[13px] text-[#667085]">{productCategoryLabel(model.productCategory ?? model.businessLine?.productCategory)}</span>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-[#344054]">{model.manufacturer || 'Chưa có hãng'}</td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full border border-[#abefc6] bg-[#ecfdf3] px-2.5 py-1 text-[#067647]">Còn kho {stock?.inStock ?? 0}</span>
          <span className="rounded-full border border-[#dde5ee] bg-[#f4f7fb] px-2.5 py-1 text-[#344054]">Tổng {stock?.total ?? 0}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        {canAddProduct ? (
          <Link className="primary-button compact" to={`/business-lines/add-product?modelId=${model.id}`}>
            <PackagePlus size={16} />
            Add sản phẩm
          </Link>
        ) : (
          <span className="text-[13px] text-[#667085]">Chỉ xem</span>
        )}
      </td>
    </tr>
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
    <div className="rounded-lg border border-[#fecdca] bg-white shadow-[0_18px_42px_rgba(23,32,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf2f7] p-5">
        <div className="flex min-w-0 gap-4">
          <ModelImage large model={model} />
          <div className="min-w-0">
            <span className="text-xs font-medium text-[#667085]">Chi tiết model</span>
            <h3 className="mt-1 text-xl font-medium text-[#101828]">{modelShortLabel(model)}</h3>
            <p className="mt-1 text-sm text-[#667085]">{modelDetailLabel(model)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full border border-[#abefc6] bg-[#ecfdf3] px-2.5 py-1 text-[#067647]">{warehouseQuantity} máy còn kho</span>
              <span className="rounded-full border border-[#dde5ee] bg-[#f4f7fb] px-2.5 py-1 text-[#344054]">{totalMachines} máy tổng</span>
              <span className="rounded-full border border-[#dde5ee] bg-white px-2.5 py-1 text-[#344054]">{model.businessLine?.productIndustry?.name ?? 'Chưa phân ngành'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-5 min-[1320px]:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4 self-start">
          {canEditImage ? (
            <div className="rounded-lg border border-[#dde5ee] bg-[#f8fafc] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#344054]">
                Ảnh model
                <input
                  className="h-10 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
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
          <strong className="text-sm text-[#101828]">Danh sách serial</strong>

          <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
            {machines.map((machine) => (
              <button
                className={`rounded-lg border p-3 text-left ${
                  selectedMachineId === machine.id ? 'border-[#fecdca] bg-[#fff8f7]' : 'border-[#dde5ee] bg-[#f8fafc] hover:border-[#d92d20]'
                }`}
                key={machine.id}
                onClick={() => void onSelectMachine(machine.id)}
                type="button"
              >
                <strong className="block text-sm text-[#101828]">{machine.serialNumber}</strong>
                <span className="mt-1 block text-[13px] text-[#667085]">
                  {[machine.machineCode, inventoryLabel(machine.inventoryStatus), machine.customer?.name].filter(Boolean).join(' - ') || 'Chưa có thông tin thêm'}
                </span>
                <small className="mt-1 block text-xs text-[#667085]">{machine._count?.accessories ?? 0} phụ kiện</small>
              </button>
            ))}

            {!loadingModelDetail && machines.length === 0 ? <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#667085]">Model này chưa có máy thực tế.</p> : null}
            {loadingModelDetail ? (
              <p className="rounded-lg bg-[#f8fafc] p-4 text-sm font-semibold text-[#667085]">
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
      <section className="rounded-lg border border-[#dde5ee] bg-white p-6 text-sm font-semibold text-[#667085]">
        <Loader2 className="spin-icon mr-2 inline" size={18} />
        Đang tải chi tiết máy
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="rounded-lg border border-[#dde5ee] bg-white p-6 text-sm text-[#667085]">
        Chọn một serial máy để xem chi tiết máy và phụ kiện đi kèm.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#dde5ee] bg-white">
      <div className="border-b border-[#edf2f7] p-4">
        <span className="text-xs font-medium text-[#667085]">Chi tiết máy</span>
        <h2 className="mt-1 text-lg font-medium text-[#101828]">{detail.serialNumber}</h2>
        <p className="mt-1 text-sm text-[#667085]">{[detail.machineCode, detail.modelName, detail.manufacturer].filter(Boolean).join(' - ')}</p>
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
            <strong className="text-sm text-[#101828]">Phụ kiện</strong>
            <span className="text-xs font-medium text-[#667085]">{detail.accessories?.length ?? 0} phụ kiện</span>
          </div>
          <div className="grid gap-2">
            {detail.accessories?.map((accessory) => (
              <div className="rounded-lg border border-[#dde5ee] bg-[#f8fafc] p-3" key={accessory.id}>
                <strong className="block text-sm text-[#101828]">{accessory.name}</strong>
                <span className="mt-1 block text-[13px] text-[#667085]">
                  {[accessory.serialNumber, accessory.code].filter(Boolean).join(' - ') || 'Chưa có S/N'}
                </span>
                <small className="mt-1 block text-xs text-[#667085]">{accessory.componentAccessory?.component?.name || accessory.note || 'Phụ kiện theo máy'}</small>
              </div>
            ))}
            {!detail.accessories?.length ? <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#667085]">Máy này chưa khai báo phụ kiện.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-[#dde5ee] bg-[#f8fafc] p-3">
      <span className="block text-xs font-medium text-[#667085]">{label}</span>
      <strong className="mt-1 block text-sm text-[#101828]">{value || 'Chưa có'}</strong>
    </div>
  );
}

function IndustryStockCard({ label, stock }: { label: string; stock: ModelStock }) {
  return (
    <div className="grid gap-2 rounded-lg border border-[#dde5ee] bg-white p-4 font-sans shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className="text-sm font-semibold text-[#667085]">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <strong className="text-3xl leading-none text-[#101828]">{stock.total}</strong>
        <span className="rounded-full border border-[#abefc6] bg-[#ecfdf3] px-2.5 py-1 text-xs font-medium text-[#067647]">Còn kho {stock.inStock}</span>
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
  return `inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
    active ? 'border-[#fecdca] bg-[#fff4f2] text-[#d92d20]' : 'border-[#dde5ee] bg-[#f4f7fb] text-[#344054] hover:border-[#d92d20]'
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
      <span className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg border border-[#dde5ee] bg-[#f4f7fb] text-[#98a2b3]`}>
        <ImageOff size={large ? 28 : 18} />
      </span>
    );
  }

  return (
    <span className={`${sizeClass} block shrink-0 overflow-hidden rounded-lg border border-[#dde5ee] bg-white`}>
      <img alt={model?.name ?? ''} className="h-full w-full object-cover" onError={() => setHasError(true)} src={imageUrl} />
    </span>
  );
}

function expertiseLabel(value?: ExpertiseGroup | null) {
  if (value === 'LAB_TESTING') return 'Xét nghiệm';
  if (value === 'IMAGING') return 'Chẩn đoán hình ảnh';
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

function modelShortLabel(model: MachineModel) {
  return model.code || model.displayName || model.name;
}

function modelDetailLabel(model: MachineModel) {
  return [model.name, model.productLine, model.businessLine?.name].filter(Boolean).join(' - ') || 'Chưa có mô tả model';
}

function modelOptionLabel(model: MachineModel) {
  const industry = model.businessLine?.productIndustry?.name;
  return [modelShortLabel(model), model.name, model.manufacturer, industry].filter(Boolean).join(' - ');
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
