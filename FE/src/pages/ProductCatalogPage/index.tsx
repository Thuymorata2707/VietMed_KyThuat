import { Boxes, CheckCircle2, Edit3, ImageOff, PackagePlus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { getRoleName } from '../../auth/roles';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { formatMachineAccessoriesText, parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';
import './styles.css';

type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING';
type ProductModalMode = 'import' | 'edit' | 'delete' | 'machine-create' | 'machine-edit' | 'machine-delete';

type ProductIndustry = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  expertiseGroup: ExpertiseGroup;
  status?: string;
  businessLines?: BusinessLine[];
};

type BusinessLine = {
  id: string;
  code: string;
  name: string;
  manufacturer?: string | null;
  imageUrl?: string | null;
  productCategory?: string | null;
  description?: string | null;
  expertiseGroup?: ExpertiseGroup | null;
  productIndustry?: ProductIndustry | null;
};

type MachineModel = {
  id: string;
  code: string;
  name: string;
  displayName?: string | null;
  manufacturer?: string | null;
  productLine?: string | null;
  description?: string | null;
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
  description?: string | null;
  accessories?: ComponentAccessory[];
};

type ComponentAccessory = {
  id: string;
  code: string;
  name: string;
  requiresSerial?: boolean;
};

type MachineItem = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  inventoryStatus?: string;
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
  accessories?: MachineAccessory[];
};

type ModelStock = {
  inStock: number;
  total: number;
};

type ProductForm = {
  productIndustryId: string;
  code: string;
  name: string;
  imageUrl: string;
  productCategory: string;
  description: string;
};

type ImportMachineForm = {
  machineModelId: string;
  serialNumbers: string;
  warehouseImportDate: string;
};

type MachineForm = {
  machineModelId: string;
  machineCode: string;
  serialNumber: string;
  warehouseImportDate: string;
  accessoriesText: string;
};

const productCategoryOptions = [
  { label: 'Siêu âm', value: 'ULTRASOUND' },
  { label: 'Xét nghiệm', value: 'LAB_TESTING' },
  { label: 'Sinh hóa', value: 'BIOCHEMISTRY' },
  { label: 'Miễn dịch', value: 'IMMUNOLOGY' },
  { label: 'Huyết học', value: 'HEMATOLOGY' },
  { label: 'X-Quang', value: 'X_RAY' },
  { label: 'Nội soi', value: 'ENDOSCOPY' },
  { label: 'Khác', value: 'OTHER' },
];

export function ProductCatalogPage({ user }: { user: ApiUser }) {
  const [industries, setIndustries] = useState<ProductIndustry[]>([]);
  const [selectedIndustryId, setSelectedIndustryId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [models, setModels] = useState<MachineModel[]>([]);
  const [query, setQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [productModalMode, setProductModalMode] = useState<ProductModalMode | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm(''));
  const [machineForm, setMachineForm] = useState<MachineForm>(emptyMachineForm(''));
  const [editingMachine, setEditingMachine] = useState<MachineDetail | null>(null);
  const [activeMachineModel, setActiveMachineModel] = useState<MachineModel | null>(null);
  const [importForm, setImportForm] = useState<ImportMachineForm>(emptyImportForm(''));
  const [stockByModel, setStockByModel] = useState<Record<string, ModelStock>>({});
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModelDetail, setSelectedModelDetail] = useState<MachineModelDetail | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedMachineDetail, setSelectedMachineDetail] = useState<MachineDetail | null>(null);
  const [loadingIndustries, setLoadingIndustries] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingModelDetail, setLoadingModelDetail] = useState(false);
  const [loadingMachineDetail, setLoadingMachineDetail] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getRoleName(user);
  const userExpertise = user.engineerProfile?.expertiseGroup ?? null;

  useEffect(() => {
    void loadIndustries();
  }, []);

  const visibleIndustries = useMemo(() => {
    if (role !== 'engineer' || !userExpertise) return industries;
    return industries.filter((industry) => industry.expertiseGroup === userExpertise);
  }, [industries, role, userExpertise]);

  const selectedIndustry = visibleIndustries.find((industry) => industry.id === selectedIndustryId) ?? visibleIndustries[0];
  const products = selectedIndustry?.businessLines ?? [];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;

    return products.filter((product) =>
      [product.name, product.code, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [products, query]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? filteredProducts[0] ?? products[0];
  const filteredModels = useMemo(() => {
    const normalizedQuery = modelQuery.trim().toLowerCase();
    if (!normalizedQuery) return models;

    return models.filter((model) =>
      [model.code, model.name, model.displayName, model.productLine, model.manufacturer]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [modelQuery, models]);

  useEffect(() => {
    if (!selectedIndustry) {
      setSelectedIndustryId('');
      setSelectedProductId('');
      return;
    }

    if (selectedIndustry.id !== selectedIndustryId) {
      setSelectedIndustryId(selectedIndustry.id);
      setSelectedProductId('');
    }
  }, [selectedIndustry, selectedIndustryId]);

  useEffect(() => {
    if (!selectedProduct) {
      setModels([]);
      setSelectedProductId('');
      setModelQuery('');
      return;
    }

    if (selectedProduct.id !== selectedProductId) {
      setSelectedProductId(selectedProduct.id);
      setModelQuery('');
    }

    void loadModels(selectedProduct.id);
  }, [selectedProduct?.id]);

  async function loadIndustries() {
    setLoadingIndustries(true);
    setError('');

    try {
      const result = await apiFetch<Paginated<ProductIndustry>>('/product-industries?limit=100');
      const nextIndustries = result.data ?? [];
      setIndustries(nextIndustries);
      return nextIndustries;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh mục ngành hàng.');
      return [];
    } finally {
      setLoadingIndustries(false);
    }
  }

  async function loadModels(productId: string) {
    setLoadingModels(true);
    setError('');

    try {
      const result = await apiFetch<Paginated<MachineModel>>(`/machine-models?businessLineId=${productId}&limit=100`);
      const nextModels = result.data ?? [];
      setModels(nextModels);
      setSelectedModelId('');
      setSelectedModelDetail(null);
      setSelectedMachineId('');
      setSelectedMachineDetail(null);
      await loadModelStock(nextModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được model máy.');
    } finally {
      setLoadingModels(false);
    }
  }

  function selectIndustry(industryId: string) {
    setSelectedIndustryId(industryId);
    setSelectedProductId('');
    setQuery('');
    setModelQuery('');
  }

  async function loadModelStock(nextModels: MachineModel[]) {
    const entries = await Promise.all(
      nextModels.map(async (model) => {
        const [inStockResult, totalResult] = await Promise.all([
          apiFetch<Paginated<MachineItem>>(`/machines?machineModelId=${model.id}&inventoryStatus=IN_STOCK&limit=1`),
          apiFetch<Paginated<MachineItem>>(`/machines?machineModelId=${model.id}&limit=1`),
        ]);

        return [model.id, { inStock: inStockResult.meta.total, total: totalResult.meta.total }] as const;
      }),
    );

    setStockByModel(Object.fromEntries(entries));
  }

  function startImportMachines(modelId?: string) {
    setError('');
    setSuccess('');
    setImportForm(emptyImportForm(modelId || models[0]?.id || ''));
    setProductModalMode('import');
  }

  function startCreateMachine(model: MachineModel) {
    setError('');
    setSuccess('');
    setActiveMachineModel(model);
    setEditingMachine(null);
    setMachineForm({
      ...emptyMachineForm(model.id),
      accessoriesText: buildTemplateAccessoriesText(model),
    });
    setProductModalMode('machine-create');
  }

  async function selectModel(modelId: string) {
    setSelectedModelId(modelId);
    setSelectedMachineId('');
    setSelectedMachineDetail(null);
    setLoadingModelDetail(true);
    setError('');

    try {
      const detail = await apiFetch<MachineModelDetail>(`/machine-models/${modelId}`);
      setSelectedModelDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách máy theo model.');
    } finally {
      setLoadingModelDetail(false);
    }
  }

  async function selectMachine(machineId: string) {
    setSelectedMachineId(machineId);
    setLoadingMachineDetail(true);
    setError('');

    try {
      const detail = await apiFetch<MachineDetail>(`/machines/${machineId}`);
      setSelectedMachineDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phụ kiện của máy.');
    } finally {
      setLoadingMachineDetail(false);
    }
  }

  async function startEditMachine(machineId: string) {
    setError('');
    setSuccess('');
    setLoadingMachineDetail(true);

    try {
      const detail = await apiFetch<MachineDetail>(`/machines/${machineId}`);
      setEditingMachine(detail);
      setSelectedMachineId(machineId);
      setSelectedMachineDetail(detail);
      setMachineForm({
        machineModelId: selectedModelId || detail.id,
        machineCode: detail.machineCode || '',
        serialNumber: detail.serialNumber || '',
        warehouseImportDate: '',
        accessoriesText: buildExistingAccessoriesText(detail),
      });
      setProductModalMode('machine-edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được máy để sửa.');
    } finally {
      setLoadingMachineDetail(false);
    }
  }

  async function startDeleteMachine(machineId: string) {
    setError('');
    setSuccess('');
    setLoadingMachineDetail(true);

    try {
      const detail = await apiFetch<MachineDetail>(`/machines/${machineId}`);
      setEditingMachine(detail);
      setProductModalMode('machine-delete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được máy để xóa.');
    } finally {
      setLoadingMachineDetail(false);
    }
  }

  function startEditProduct(product: BusinessLine) {
    setError('');
    setSuccess('');
    setProductForm({
      productIndustryId: selectedIndustry?.id || product.productIndustry?.id || '',
      code: product.code || '',
      name: product.name || '',
      imageUrl: product.imageUrl || '',
      productCategory: product.productCategory || 'OTHER',
      description: product.description || '',
    });
    setProductModalMode('edit');
  }

  function startDeleteProduct(product: BusinessLine) {
    setError('');
    setSuccess('');
    setSelectedProductId(product.id);
    setProductModalMode('delete');
  }

  function closeProductModal() {
    setProductModalMode(null);
    setProductForm(emptyProductForm(selectedIndustry?.id || ''));
    setMachineForm(emptyMachineForm(selectedModelId || ''));
    setEditingMachine(null);
    setActiveMachineModel(null);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productModalMode || productModalMode === 'delete' || productModalMode === 'import') return;

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      const industry = industries.find((item) => item.id === productForm.productIndustryId);
      const payload = buildProductPayload(productForm, industry);
      const savedProduct = await apiFetch<BusinessLine>(`/business-lines/${selectedProduct?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSelectedIndustryId(productForm.productIndustryId);
      setSelectedProductId(savedProduct.id);
      setSuccess('Đã cập nhật nhóm sản phẩm.');
      closeProductModal();
      await loadIndustries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được nhóm sản phẩm.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function submitImportMachines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const model = models.find((item) => item.id === importForm.machineModelId);
    if (!model) {
      setError('Vui lòng chọn model máy cần nhập.');
      return;
    }

    const serialNumbers = importForm.serialNumbers
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!serialNumbers.length) {
      setError('Vui lòng nhập ít nhất một Serial Number.');
      return;
    }

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      for (const serialNumber of serialNumbers) {
        await apiFetch('/machines', {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              serialNumber,
              machineModelId: model.id,
              inventoryStatus: 'IN_STOCK',
              status: 'ACTIVE',
              warehouseImportDate: importForm.warehouseImportDate,
            }),
          ),
        });
      }

      setSuccess(`Đã nhập ${serialNumbers.length} máy ${modelShortLabel(model)} vào kho.`);
      closeProductModal();
      await loadModels(selectedProduct?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhập được máy vào kho.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function submitMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      if (editingMachine) {
        const model = activeMachineModel || models.find((item) => item.id === machineForm.machineModelId);
        await apiFetch(`/machines/${editingMachine.id}`, {
          method: 'PATCH',
          body: JSON.stringify(
            compactPayload({
              machineCode: machineForm.machineCode.trim(),
              serialNumber: machineForm.serialNumber.trim(),
              accessories: parseExistingAccessoryLines(machineForm.accessoriesText),
            }),
          ),
        });

        setSuccess('Đã cập nhật máy và S/N phụ kiện.');
      } else {
        const model = activeMachineModel || models.find((item) => item.id === machineForm.machineModelId);
        if (!model) throw new Error('Vui lòng chọn model máy.');

        await apiFetch('/machines', {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              machineModelId: model.id,
              serialNumber: machineForm.serialNumber.trim(),
              machineCode: machineForm.machineCode.trim(),
              warehouseImportDate: machineForm.warehouseImportDate,
              inventoryStatus: 'IN_STOCK',
              status: 'ACTIVE',
              accessories: parseTemplateAccessoryLines(machineForm.accessoriesText, model),
            }),
          ),
        });
        setSuccess('Đã thêm máy theo model và phụ kiện đi kèm.');
      }

      closeProductModal();
      await loadModels(selectedProduct?.id || '');
      if (selectedModelId) await selectModel(selectedModelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được máy theo model.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteSelectedMachine() {
    if (!editingMachine) return;

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/machines/${editingMachine.id}`, { method: 'DELETE' });
      setSuccess('Đã xóa máy theo model.');
      closeProductModal();
      await loadModels(selectedProduct?.id || '');
      if (selectedModelId) await selectModel(selectedModelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được máy theo model.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteSelectedProduct() {
    if (!selectedProduct) return;

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/business-lines/${selectedProduct.id}`, { method: 'DELETE' });
      setSelectedProductId('');
      setModels([]);
      setSuccess('Đã xóa nhóm sản phẩm.');
      closeProductModal();
      await loadIndustries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được nhóm sản phẩm.');
    } finally {
      setSavingProduct(false);
    }
  }

  return (
    <PageFrame>
      <div className="catalog-heading">
        <PageTitle
          eyebrow="Danh mục sản phẩm"
          title="Danh mục theo ngành hàng"
          description="Quản lý theo thứ tự ngành hàng, nhóm sản phẩm, model máy, thành phần và phụ kiện trong một màn."
        />
        <div className="catalog-actions">
          {role === 'admin' ? (
            <button className="primary-button" disabled={!models.length} onClick={() => startImportMachines()} type="button">
              <PackagePlus size={17} />
              Nhập máy
            </button>
          ) : null}
          <button className="secondary-button" disabled={loadingIndustries} onClick={() => void loadIndustries()} type="button">
            <RefreshCw size={17} />
            Tải lại
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="industry-tabs" aria-label="Ngành hàng sản phẩm">
        {visibleIndustries.map((industry) => (
          <button
            className={industry.id === selectedIndustry?.id ? 'industry-tab active' : 'industry-tab'}
            key={industry.id}
            onClick={() => selectIndustry(industry.id)}
            type="button"
          >
            <strong>{industry.name}</strong>
            <span>{industry.businessLines?.length ?? 0} nhóm</span>
          </button>
        ))}
      </section>

      <section className="catalog-layout">
        <div className="product-panel">
          <div className="product-toolbar">
            <div>
              <span className="catalog-eyebrow">{selectedIndustry?.name || 'Chưa chọn ngành hàng'}</span>
              <h2>Nhóm sản phẩm</h2>
            </div>
            <label className="catalog-search">
              <Search size={17} />
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nhóm sản phẩm" value={query} />
            </label>
          </div>

          <div className="product-content">
            <div className="product-list">
              {filteredProducts.map((product) => (
                <button
                  className={product.id === selectedProduct?.id ? 'product-item active' : 'product-item'}
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  type="button"
                >
                  <ProductImage product={product} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.code || 'Chưa có mã nhóm'}</small>
                  </span>
                </button>
              ))}
              {!loadingIndustries && filteredProducts.length === 0 ? (
                <div className="catalog-empty">Chưa có nhóm sản phẩm trong ngành hàng này.</div>
              ) : null}
            </div>

            <ProductDetail
              loading={loadingModels}
              allModelCount={models.length}
              modelQuery={modelQuery}
              models={filteredModels}
              onDelete={startDeleteProduct}
              onEdit={startEditProduct}
              onImport={startImportMachines}
              onCreateMachine={startCreateMachine}
              onDeleteMachine={startDeleteMachine}
              onEditMachine={startEditMachine}
              onSelectMachine={selectMachine}
              onSelectModel={selectModel}
              onSetModelQuery={setModelQuery}
              product={selectedProduct}
              role={role}
              selectedMachineDetail={selectedMachineDetail}
              selectedMachineId={selectedMachineId}
              selectedModelDetail={selectedModelDetail}
              selectedModelId={selectedModelId}
              stockByModel={stockByModel}
              loadingMachineDetail={loadingMachineDetail}
              loadingModelDetail={loadingModelDetail}
            />
          </div>
        </div>
      </section>

      {!loadingIndustries && visibleIndustries.length === 0 ? (
        <div className="catalog-empty standalone">Chưa có ngành hàng phù hợp với quyền kỹ sư.</div>
      ) : null}

      {productModalMode ? (
        <ProductEditorModal
          industries={visibleIndustries}
          mode={productModalMode}
          onClose={closeProductModal}
          onDelete={deleteSelectedProduct}
          onSubmit={submitProduct}
          onSubmitImport={submitImportMachines}
          product={selectedProduct}
          saving={savingProduct}
          importValue={importForm}
          machineValue={machineForm}
          models={models}
          activeMachineModel={activeMachineModel}
          editingMachine={editingMachine}
          onDeleteMachine={deleteSelectedMachine}
          onSubmitMachine={submitMachine}
          setImportValue={(field, value) => setImportForm((current) => ({ ...current, [field]: value }))}
          setMachineValue={(field, value) => setMachineForm((current) => ({ ...current, [field]: value }))}
          setValue={(field, value) => setProductForm((current) => ({ ...current, [field]: value }))}
          value={productForm}
        />
      ) : null}
    </PageFrame>
  );
}

function ProductDetail({
  product,
  models,
  allModelCount,
  loading,
  loadingMachineDetail,
  loadingModelDetail,
  modelQuery,
  role,
  onEdit,
  onDelete,
  onImport,
  onCreateMachine,
  onDeleteMachine,
  onEditMachine,
  onSelectMachine,
  onSelectModel,
  onSetModelQuery,
  selectedMachineDetail,
  selectedMachineId,
  selectedModelDetail,
  selectedModelId,
  stockByModel,
}: {
  product?: BusinessLine;
  models: MachineModel[];
  allModelCount: number;
  loading: boolean;
  loadingMachineDetail: boolean;
  loadingModelDetail: boolean;
  modelQuery: string;
  role: string;
  onEdit: (product: BusinessLine) => void;
  onDelete: (product: BusinessLine) => void;
  onImport: (modelId?: string) => void;
  onCreateMachine: (model: MachineModel) => void;
  onDeleteMachine: (machineId: string) => void;
  onEditMachine: (machineId: string) => void;
  onSelectMachine: (machineId: string) => void;
  onSelectModel: (modelId: string) => void;
  onSetModelQuery: (value: string) => void;
  selectedMachineDetail: MachineDetail | null;
  selectedMachineId: string;
  selectedModelDetail: MachineModelDetail | null;
  selectedModelId: string;
  stockByModel: Record<string, ModelStock>;
}) {
  if (!product) {
    return <div className="product-detail empty-detail">Chọn một nhóm sản phẩm để xem model, thành phần và phụ kiện.</div>;
  }

  const totalInStock = models.reduce((sum, model) => sum + (stockByModel[model.id]?.inStock ?? 0), 0);
  const totalMachines = models.reduce((sum, model) => sum + (stockByModel[model.id]?.total ?? 0), 0);
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const selectedModelView = selectedModelDetail ?? selectedModel;

  return (
    <article className="product-detail">
      <div className="product-summary">
        <div className="product-summary-main">
          <ProductImage product={product} />
          <div>
            <span className="catalog-eyebrow">{product.productIndustry?.name || 'Nhóm sản phẩm'}</span>
            <h2>{product.name}</h2>
            <p>{product.description || 'Chưa có mô tả nhóm sản phẩm.'}</p>
          </div>
        </div>
        <div className="product-summary-stats">
          <span>
            <strong>{models.length}</strong>
            Model
          </span>
          <span>
            <strong>{totalInStock}</strong>
            Còn kho
          </span>
          <span>
            <strong>{totalMachines}</strong>
            Tổng máy
          </span>
        </div>
      </div>

      <div className="product-context-bar">
        <div className="detail-meta">
          <span>{product.code}</span>
          <span>{expertiseLabel(product.expertiseGroup)}</span>
        </div>
        {role === 'admin' ? (
          <div className="product-detail-actions">
            <button className="secondary-button compact" onClick={() => onEdit(product)} type="button">
              <Edit3 size={16} />
              Sửa nhóm
            </button>
            <button className="danger-button compact" onClick={() => onDelete(product)} type="button">
              <Trash2 size={16} />
              Xóa nhóm
            </button>
          </div>
        ) : null}
      </div>

      <div className="model-section">
        <div className="model-section-title">
          <div>
            <strong>Model thuộc nhóm</strong>
            <span>{loading ? 'Đang tải' : allModelCount === models.length ? `${models.length} model` : `${models.length}/${allModelCount} model`}</span>
          </div>
          <label className="model-search">
            <Search size={16} />
            <input onChange={(event) => onSetModelQuery(event.target.value)} placeholder="Tìm XCUBE90, CL9000I..." value={modelQuery} />
          </label>
        </div>

        <div className="model-table">
          {models.map((model) => {
            const isSelectedModel = model.id === selectedModelId;

            return (
              <Fragment key={model.id}>
                <section className={isSelectedModel ? 'model-row active' : 'model-row'}>
                <button className="model-row-main" onClick={() => onSelectModel(model.id)} type="button">
                  <span>
                    <strong>{modelShortLabel(model)}</strong>
                    <small>{modelDetailLabel(model)}</small>
                  </span>
                </button>
                <div className="model-row-metrics">
                  <span className="stock-badge">
                    Còn kho <strong>{stockByModel[model.id]?.inStock ?? 0}</strong>
                  </span>
                  <span className="stock-badge muted">
                    Tổng <strong>{stockByModel[model.id]?.total ?? 0}</strong>
                  </span>
                </div>
                <div className="model-row-actions">
                  {role === 'admin' ? (
                    <>
                      <button className="primary-button compact" onClick={() => onCreateMachine(model)} type="button">
                        Thêm máy
                      </button>
                      <button className="secondary-button compact" onClick={() => onImport(model.id)} type="button">
                        Nhập nhiều
                      </button>
                    </>
                  ) : null}
                  <button className="secondary-button compact" onClick={() => onSelectModel(model.id)} type="button">
                    {isSelectedModel ? 'Đang xem' : 'Xem S/N'}
                  </button>
                </div>
                </section>

                {isSelectedModel && selectedModel ? (
                  <div className="machine-stock-panel">
                    <div className="machine-stock-head">
                      <div>
                        <strong>{modelShortLabel(selectedModel)}</strong>
                        <span>
                          {loadingModelDetail
                            ? 'Đang tải danh sách máy'
                            : `${selectedModelDetail?.warehouseQuantity ?? stockByModel[selectedModel.id]?.inStock ?? 0} máy còn kho / ${
                                selectedModelDetail?.machines?.length ?? 0
                              } máy tổng`}
                        </span>
                      </div>
                      <div className="template-summary">
                        <span>{countModelAccessories(selectedModelView)} phụ kiện mẫu</span>
                        <span>{selectedModelView?.components?.length ?? 0} thành phần</span>
                      </div>
                    </div>

                    <div className="machine-serial-layout">
                      <div className="machine-serial-list">
                        {(selectedModelDetail?.machines ?? []).map((machine) => (
                          <div className={machine.id === selectedMachineId ? 'machine-serial-item active' : 'machine-serial-item'} key={machine.id}>
                            <button onClick={() => onSelectMachine(machine.id)} type="button">
                              <strong>{machine.serialNumber}</strong>
                              <span>{[machine.machineCode, inventoryLabel(machine.inventoryStatus)].filter(Boolean).join(' - ')}</span>
                              <small>{machine.customer?.name || `${machine._count?.accessories ?? 0} phụ kiện`}</small>
                            </button>
                            {role === 'admin' ? (
                              <span className="machine-row-actions">
                                <button className="icon-button" onClick={() => onEditMachine(machine.id)} title="Sửa máy" type="button">
                                  <Edit3 size={15} />
                                </button>
                                <button className="icon-button danger" onClick={() => onDeleteMachine(machine.id)} title="Xóa máy" type="button">
                                  <Trash2 size={15} />
                                </button>
                              </span>
                            ) : null}
                          </div>
                        ))}
                        {!loadingModelDetail && (selectedModelDetail?.machines ?? []).length === 0 ? (
                          <p className="component-empty">Model này chưa có máy vật lý nào trong kho/hệ thống.</p>
                        ) : null}
                      </div>

                      <div className="machine-accessory-panel">
                        {selectedMachineDetail ? (
                          <>
                            <div className="machine-accessory-head">
                              <strong>{selectedMachineDetail.serialNumber}</strong>
                              <span>{inventoryLabel(selectedMachineDetail.inventoryStatus)}</span>
                            </div>
                            {selectedMachineDetail.accessories?.length ? (
                              <div className="machine-accessory-list">
                                {selectedMachineDetail.accessories.map((accessory) => (
                                  <div className="machine-accessory-item" key={accessory.id}>
                                    <strong>{accessory.name}</strong>
                                    <span>{[accessory.serialNumber, accessory.code].filter(Boolean).join(' - ') || 'Chưa có S/N'}</span>
                                    <small>{accessory.componentAccessory?.component?.name || accessory.note || 'Phụ kiện theo máy'}</small>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="component-empty">Máy này chưa khai báo phụ kiện riêng.</p>
                            )}
                          </>
                        ) : (
                          <p className="component-empty">
                            {loadingMachineDetail ? 'Đang tải phụ kiện máy.' : 'Chọn một S/N máy để xem phụ kiện riêng.'}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedModelView?.components?.length ? (
                      <details className="template-accessories">
                        <summary>Cấu hình phụ kiện mẫu của model</summary>
                        <div className="component-list">
                          {selectedModelView.components.map((component) => (
                            <div className="component-block" key={component.id}>
                              <div className="component-title">
                                <Boxes size={16} />
                                <strong>{component.name}</strong>
                                <span>{component.code}</span>
                              </div>
                              {component.accessories?.length ? (
                                <div className="accessory-list">
                                  {component.accessories.map((accessory) => (
                                    <span className="accessory-chip" key={accessory.id}>
                                      <CheckCircle2 size={15} />
                                      {accessory.name}
                                      {accessory.requiresSerial ? <small>Cần S/N</small> : null}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="component-empty">Chưa khai báo phụ kiện.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>

        {!loading && models.length === 0 ? <div className="catalog-empty">Nhóm này chưa có model máy.</div> : null}
      </div>
    </article>
  );
}

function ProductEditorModal({
  industries,
  mode,
  product,
  value,
  saving,
  setValue,
  importValue,
  machineValue,
  setImportValue,
  setMachineValue,
  models,
  activeMachineModel,
  editingMachine,
  onClose,
  onSubmit,
  onSubmitImport,
  onSubmitMachine,
  onDelete,
  onDeleteMachine,
}: {
  industries: ProductIndustry[];
  mode: ProductModalMode;
  product?: BusinessLine;
  value: ProductForm;
  importValue: ImportMachineForm;
  machineValue: MachineForm;
  models: MachineModel[];
  activeMachineModel: MachineModel | null;
  editingMachine: MachineDetail | null;
  saving: boolean;
  setValue: (field: keyof ProductForm, value: string) => void;
  setImportValue: (field: keyof ImportMachineForm, value: string) => void;
  setMachineValue: (field: keyof MachineForm, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitImport: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitMachine: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onDeleteMachine: () => void;
}) {
  if (mode === 'machine-delete') {
    return (
      <div className="product-editor-backdrop" role="presentation">
        <section aria-modal="true" className="product-editor-modal compact" role="dialog">
          <div className="product-editor-heading">
            <div>
              <span>Xóa máy theo model</span>
              <h2>{editingMachine?.serialNumber || 'Máy nhập kho'}</h2>
            </div>
            <button className="icon-button" onClick={onClose} title="Đóng" type="button">
              <X size={16} />
            </button>
          </div>
          <p className="delete-warning">
            Chỉ xóa được máy chưa có phiếu lắp đặt, sửa chữa, bảo trì hoặc dữ liệu vận hành liên quan.
          </p>
          <div className="product-editor-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button className="danger-button" disabled={saving} onClick={onDeleteMachine} type="button">
              {saving ? 'Đang xóa' : 'Xóa máy'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === 'machine-create' || mode === 'machine-edit') {
    const modelName = activeMachineModel ? modelShortLabel(activeMachineModel) : 'Model máy';
    const supportsProbes = isUltrasoundMachineModel(activeMachineModel);
    return (
      <div className="product-editor-backdrop" role="presentation">
        <section aria-modal="true" className="product-editor-modal" role="dialog">
          <div className="product-editor-heading">
            <div>
              <span>{mode === 'machine-create' ? 'Thêm máy theo model' : 'Sửa máy theo model'}</span>
              <h2>{mode === 'machine-create' ? modelName : editingMachine?.serialNumber}</h2>
            </div>
            <button className="icon-button" onClick={onClose} title="Đóng" type="button">
              <X size={16} />
            </button>
          </div>

          <form className="product-editor-form" onSubmit={onSubmitMachine}>
            <div className="form-step">
              <span>1</span>
              <div>
                <h3>Thông tin máy nhập kho</h3>
                <div className="product-form-grid">
                  <label>
                    Serial Number máy
                    <input onChange={(event) => setMachineValue('serialNumber', event.target.value)} required value={machineValue.serialNumber} />
                  </label>
                  <label>
                    Mã máy nội bộ
                    <input onChange={(event) => setMachineValue('machineCode', event.target.value)} value={machineValue.machineCode} />
                  </label>
                  {mode === 'machine-create' ? (
                    <label>
                      Ngày nhập kho
                      <input
                        onChange={(event) => setMachineValue('warehouseImportDate', event.target.value)}
                        type="date"
                        value={machineValue.warehouseImportDate}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="form-step">
              <span>2</span>
              <div>
                <h3>{supportsProbes ? 'S/N đầu dò đi kèm' : 'S/N phụ kiện đi kèm'}</h3>
                {supportsProbes ? (
                  <MachineAccessoryEditor onChange={(value) => setMachineValue('accessoriesText', value)} value={machineValue.accessoriesText} />
                ) : (
                  <label>
                    Phụ kiện
                    <textarea
                      onChange={(event) => setMachineValue('accessoriesText', event.target.value)}
                      placeholder={'Mỗi dòng: Phụ kiện | Serial Number\\nVí dụ:\\nBộ dây nguồn | ACC-001\\nCáp kết nối | ACC-002'}
                      value={formatMachineAccessoriesText(machineValue.accessoriesText)}
                    />
                  </label>
                )}
                  <div className="serial-note">
                    {supportsProbes
                      ? 'Chọn ký hiệu đầu dò từ danh sách ALPINION và nhập S/N thực tế. Có thể thêm hoặc xóa bao nhiêu đầu dò tùy máy siêu âm.'
                      : 'Nhập phụ kiện đi kèm của máy, mỗi dòng một phụ kiện theo dạng Tên phụ kiện | S/N.'}
                  </div>
              </div>
            </div>

            <div className="product-editor-actions">
              <button className="secondary-button" onClick={onClose} type="button">
                Hủy
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Đang lưu' : mode === 'machine-create' ? 'Thêm máy' : 'Lưu máy'}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  if (mode === 'delete') {
    return (
      <div className="product-editor-backdrop" role="presentation">
        <section aria-modal="true" className="product-editor-modal compact" role="dialog">
          <div className="product-editor-heading">
            <div>
              <span>Xóa nhóm sản phẩm</span>
              <h2>{product?.name || 'Nhóm sản phẩm'}</h2>
            </div>
            <button className="icon-button" onClick={onClose} title="Đóng" type="button">
              <X size={16} />
            </button>
          </div>
          <p className="delete-warning">
            Nếu nhóm đã có model, thiết bị hoặc phiếu liên quan, backend có thể không cho xóa để giữ dữ liệu nghiệp vụ.
          </p>
          <div className="product-editor-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button className="danger-button" disabled={saving} onClick={onDelete} type="button">
              {saving ? 'Đang xóa' : 'Xóa nhóm'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === 'import') {
    return (
      <div className="product-editor-backdrop" role="presentation">
        <section aria-modal="true" className="product-editor-modal" role="dialog">
          <div className="product-editor-heading">
            <div>
              <span>Nhập máy vào kho</span>
              <h2>Chọn model có sẵn và nhập Serial Number</h2>
            </div>
            <button className="icon-button" onClick={onClose} title="Đóng" type="button">
              <X size={16} />
            </button>
          </div>

          <form className="product-editor-form" onSubmit={onSubmitImport}>
            <div className="form-step">
              <span>1</span>
              <div>
                <h3>Chọn model máy</h3>
                <label>
                  Model
                  <select
                    onChange={(event) => setImportValue('machineModelId', event.target.value)}
                    required
                    value={importValue.machineModelId}
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {modelOptionLabel(model)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="form-step">
              <span>2</span>
              <div>
                <h3>Nhập serial máy chính</h3>
                <div className="product-form-grid">
                  <label>
                    Ngày nhập kho
                    <input
                      onChange={(event) => setImportValue('warehouseImportDate', event.target.value)}
                      type="date"
                      value={importValue.warehouseImportDate}
                    />
                  </label>
                  <label className="wide-field">
                    Serial Number
                    <textarea
                      onChange={(event) => setImportValue('serialNumbers', event.target.value)}
                      placeholder={'Mỗi dòng là một máy, ví dụ:\nXC90-001\nXC90-002'}
                      required
                      value={importValue.serialNumbers}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="serial-note">
              Phụ kiện có Serial Number sẽ được quản lý theo cấu hình phụ kiện của model ở bước tiếp theo, để khi xuất lắp đặt có thể chọn đúng bộ máy và phụ kiện đi kèm.
            </div>

            <div className="product-editor-actions">
              <button className="secondary-button" onClick={onClose} type="button">
                Hủy
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Đang nhập' : 'Nhập máy'}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="product-editor-backdrop" role="presentation">
      <section aria-modal="true" className="product-editor-modal" role="dialog">
        <div className="product-editor-heading">
          <div>
            <span>Sửa nhóm sản phẩm</span>
            <h2>{product?.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Đóng" type="button">
            <X size={16} />
          </button>
        </div>

        <form className="product-editor-form" onSubmit={onSubmit}>
          <div className="form-step">
            <span>1</span>
            <div>
              <h3>Chọn ngành hàng</h3>
              <label>
                Ngành hàng
                <select
                  onChange={(event) => setValue('productIndustryId', event.target.value)}
                  required
                  value={value.productIndustryId}
                >
                  {industries.map((industry) => (
                    <option key={industry.id} value={industry.id}>
                      {industry.name} - {expertiseLabel(industry.expertiseGroup)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="form-step">
            <span>2</span>
            <div>
              <h3>Thông tin nhóm sản phẩm</h3>
              <div className="product-form-grid">
                <label>
                  Mã nhóm
                  <input onChange={(event) => setValue('code', event.target.value)} required value={value.code} />
                </label>
                <label>
                  Tên nhóm sản phẩm
                  <input onChange={(event) => setValue('name', event.target.value)} required value={value.name} />
                </label>
                <label>
                  Loại thiết bị
                  <select onChange={(event) => setValue('productCategory', event.target.value)} value={value.productCategory}>
                    {productCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide-field">
                  Ảnh nhóm sản phẩm
                  <input onChange={(event) => setValue('imageUrl', event.target.value)} type="url" value={value.imageUrl} />
                </label>
                <label className="wide-field">
                  Mô tả
                  <textarea onChange={(event) => setValue('description', event.target.value)} value={value.description} />
                </label>
              </div>
            </div>
          </div>

          <div className="product-editor-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Đang lưu' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProductImage({ product, large = false }: { product: BusinessLine; large?: boolean }) {
  const [hasError, setHasError] = useState(false);
  const className = large ? 'catalog-image large' : 'catalog-image';

  if (!product.imageUrl || hasError) {
    return (
      <span className={`${className} fallback`}>
        <ImageOff size={large ? 26 : 18} />
      </span>
    );
  }

  return (
    <span className={className}>
      <img alt={product.name} onError={() => setHasError(true)} src={product.imageUrl} />
    </span>
  );
}

function expertiseLabel(value?: ExpertiseGroup | null) {
  if (value === 'LAB_TESTING') return 'Kỹ sư Xét nghiệm';
  if (value === 'IMAGING') return 'Kỹ sư Chẩn đoán hình ảnh';
  return 'Chưa phân nhóm';
}

function modelShortLabel(model: MachineModel) {
  return model.code || model.displayName || model.name;
}

function modelDetailLabel(model: MachineModel) {
  return [model.name, model.productLine, model.manufacturer].filter(Boolean).join(' - ') || 'Chưa có mô tả model';
}

function modelOptionLabel(model: MachineModel) {
  const detail = modelDetailLabel(model);
  return detail === 'Chưa có mô tả model' ? modelShortLabel(model) : `${modelShortLabel(model)} - ${detail}`;
}

function inventoryLabel(value?: string) {
  if (value === 'IN_STOCK') return 'Trong kho';
  if (value === 'ACCESSORY_SPLIT') return 'Tách phụ kiện';
  if (value === 'INSTALLED') return 'Đã lắp';
  if (value === 'RESERVED') return 'Đã giữ';
  if (value === 'RETURNED') return 'Thu hồi';
  if (value === 'SOLD') return 'Đã bán';
  return value || '';
}

function emptyProductForm(productIndustryId: string): ProductForm {
  return {
    productIndustryId,
    code: '',
    name: '',
    imageUrl: '',
    productCategory: 'OTHER',
    description: '',
  };
}

function emptyImportForm(machineModelId: string): ImportMachineForm {
  return {
    machineModelId,
    serialNumbers: '',
    warehouseImportDate: new Date().toISOString().slice(0, 10),
  };
}

function emptyMachineForm(machineModelId: string): MachineForm {
  return {
    machineModelId,
    machineCode: '',
    serialNumber: '',
    warehouseImportDate: new Date().toISOString().slice(0, 10),
    accessoriesText: '',
  };
}

function buildProductPayload(form: ProductForm, industry?: ProductIndustry) {
  return compactPayload({
    productIndustryId: form.productIndustryId,
    code: form.code.trim(),
    name: form.name.trim(),
    imageUrl: form.imageUrl.trim(),
    productCategory: form.productCategory || 'OTHER',
    expertiseGroup: industry?.expertiseGroup,
    description: form.description.trim(),
    status: 'ACTIVE',
  });
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

function buildExistingAccessoriesText(machine: MachineDetail) {
  return serializeMachineAccessories(machine.accessories ?? []);
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

function parseExistingAccessoryLines(value: string) {
  return parseMachineAccessoriesInput(value);
}

function countModelAccessories(model?: MachineModel | null) {
  return (model?.components ?? []).reduce((sum, component) => sum + (component.accessories?.length ?? 0), 0);
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
