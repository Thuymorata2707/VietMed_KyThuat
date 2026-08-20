import { ArrowLeft, Edit3, ImageOff, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { FormEvent, KeyboardEvent, MouseEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { AdminCrudConfig, CrudField } from '../../config/adminCrud';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { GoogleMapsDirectionsButton, VietnamAddressSelects, buildFullVietnamAddress } from '../../components/VietnamAddressSelects';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { displayLabel } from '../../utils/displayLabels';
import { TableRow, filterRows, formatValue, readPath } from '../../utils/format';
import { formatMachineAccessoriesText, parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';
import './styles.css';

type SelectOption = { label: string; value: string; row?: TableRow };
type OptionMap = Record<string, SelectOption[]>;
type FormState = Record<string, string>;
type FilterState = Record<string, string>;
type CustomerStats = { active: number; assigned: number; withMachines: number };
type PaginationState = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};
type InitialBusinessLineRow = {
  code: string;
  countryOfOrigin: string;
  id?: string;
  manufacturer: string;
  name: string;
  productCategory: string;
};

const pageSizeOptions = [10, 20, 50, 100];
const initialBusinessLineCategoryOptions = [
  { label: 'Máy siêu âm', value: 'ULTRASOUND' },
  { label: 'Máy xét nghiệm', value: 'LAB_TESTING' },
  { label: 'Sinh hóa', value: 'BIOCHEMISTRY' },
  { label: 'Miễn dịch', value: 'IMMUNOLOGY' },
  { label: 'Huyết học', value: 'HEMATOLOGY' },
  { label: 'X-quang', value: 'X_RAY' },
  { label: 'Nội soi', value: 'ENDOSCOPY' },
  { label: 'Khác', value: 'OTHER' },
];
const quickFilterKeys = [
  'status',
  'inventoryStatus',
  'dataStatus',
  'createdSource',
  'priority',
  'type',
  'engineer.fullName',
  'installedBy.fullName',
  'primaryEngineer.fullName',
];

export function AdminCrudPage({
  config,
  extraQueryParams,
  headerControl,
}: {
  config: AdminCrudConfig;
  extraQueryParams?: Record<string, string>;
  headerControl?: ReactNode;
}) {
  const isCustomerCrud = isCustomersEndpoint(config.endpoint);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [options, setOptions] = useState<OptionMap>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({});
  const [form, setForm] = useState<FormState>({});
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<TableRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isCustomerCrud ? 50 : 20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPage();
  }, [config.endpoint, debouncedQuery, JSON.stringify(extraQueryParams ?? {}), page, pageSize]);

  useEffect(() => {
    setPage(1);
    setQuery('');
    setDebouncedQuery('');
    setSelectedRow(null);
    setFilters({});
  }, [config.endpoint]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const searchableRows = useMemo(() => (pagination ? rows : filterRows(rows, query)), [pagination, query, rows]);
  const filteredRows = useMemo(() => applyColumnFilters(searchableRows, filters), [filters, searchableRows]);
  const quickFilters = useMemo(() => buildQuickFilters(config, rows), [config, rows]);
  const customerStats = useMemo(() => buildCustomerStats(rows), [rows]);
  const tableColumnCount = (isCustomerCrud ? 7 : config.columns.length) + (config.canUpdate !== false || config.canDelete !== false ? 1 : 0);

  useEffect(() => {
    if (!pagination) return;
    setPage((current) => Math.min(current, Math.max(1, pagination.totalPages)));
  }, [pagination]);

  useEffect(() => {
    if (!isModalOpen || editingRow) return;
    const fields = visibleFields(config.fields, false, form, options, config.endpoint, null).filter((field) => field.previewCode);
    if (!fields.length) return;
    let cancelled = false;

    void applyPreviewCodes(fields, form, config.endpoint, options).then((previewValues) => {
      if (cancelled || !Object.keys(previewValues).length) return;
      setForm((current) => ({ ...current, ...previewValues }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    isModalOpen,
    Boolean(editingRow),
    config.endpoint,
    form.reportedAt,
    form.scheduledDate,
    form.installedAt,
    form.machineModelId,
    form.modelName,
    form.name,
  ]);

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const [rowsResult, optionsResult] = await Promise.all([
        loadRows(config.endpoint, page, pageSize, debouncedQuery, extraQueryParams),
        loadOptions(config.fields),
      ]);
      setRows(rowsResult.rows);
      setPagination(rowsResult.pagination);
      setOptions(optionsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không tải được ${config.entityLabel}`);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingRow(null);
    setForm(buildInitialForm(visibleFields(config.fields, false), null, options, config.endpoint));
    setSuccess('');
    setError('');
    setIsModalOpen(true);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function startEdit(row: TableRow) {
    setSelectedRow(null);
    setEditingRow(row);
    setForm(buildInitialForm(visibleFields(config.fields, true), row, options, config.endpoint));
    setSuccess('');
    setError('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    setForm({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const fields = visibleFields(config.fields, Boolean(editingRow), form, options, config.endpoint, editingRow);
      const payload = isMachinesEndpoint(config.endpoint) ? buildMachinePayload(fields, form, editingRow) : buildPayload(fields, form);
      if (editingRow) {
        await apiFetch(`${config.endpoint}/${String(editingRow.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật ${config.entityLabel}.`);
      } else {
        await apiFetch(config.endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã tạo ${config.entityLabel}.`);
      }

      closeModal();
      setPage(1);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không lưu được ${config.entityLabel}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeRow() {
    if (!deletingRow) return;
    setError('');
    setSuccess('');

    try {
      await apiFetch(`${config.endpoint}/${String(deletingRow.id)}`, { method: 'DELETE' });
      setSuccess(`Đã xóa ${config.entityLabel}.`);
      setDeletingRow(null);
      setSelectedRow(null);
      setPage((current) => Math.max(1, Math.min(current, pagination?.totalPages || current)));
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không xóa được ${config.entityLabel}`);
    }
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: TableRow) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedRow(row);
    }
  }

  function handleActionClick(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    event.stopPropagation();
    action();
  }

  function handleFieldChange(field: CrudField, value: string, optionRow?: TableRow) {
    setForm((current) => {
      const next = { ...current, [field.name]: value };

      if (field.name === 'machineId' && optionRow) {
        const customerId = readPath(optionRow, 'customer.id');
        const serialNumber = readPath(optionRow, 'serialNumber');
        const modelName = readPath(optionRow, 'modelName');
        const deviceName = readPath(optionRow, 'name');

        if (customerId && 'customerId' in current && !current.customerId) next.customerId = String(customerId);
        if (serialNumber && 'serialNumber' in current && !current.serialNumber) next.serialNumber = String(serialNumber);
        if (modelName && 'modelName' in current && !current.modelName) next.modelName = String(modelName);
        if (deviceName && 'deviceName' in current && !current.deviceName) next.deviceName = String(deviceName);
      }

      return next;
    });
  }

  return (
    <PageFrame>
      <div className={isCustomerCrud ? 'admin-crud-heading customer-crud-heading' : 'admin-crud-heading'}>
        <PageTitle eyebrow="Quản trị" title={config.title} description={config.description} />
        <div className="admin-crud-heading-actions">
          {headerControl}
          <button className="secondary-button" disabled={loading} onClick={loadPage} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {isCustomerCrud ? (
        <div className="customer-crud-summary">
          <CustomerMetric label="Tổng khách hàng" value={pagination?.total ?? rows.length} />
          <CustomerMetric label="Đang hoạt động" value={customerStats.active} />
          <CustomerMetric label="Đã gán kỹ sư" value={customerStats.assigned} />
          <CustomerMetric label="Có máy" value={customerStats.withMachines} />
        </div>
      ) : null}

      <section className={isCustomerCrud ? 'admin-crud-list customer-crud-list' : 'admin-crud-list'}>
        <div className="list-toolbar">
          <input aria-label="Tìm kiếm" onChange={(event) => handleSearchChange(event.target.value)} placeholder={config.searchPlaceholder} value={query} />
          {quickFilters.length ? (
            <div className="quick-filters">
              {quickFilters.map((filter) => (
                <label key={filter.key}>
                  <span>{filter.label}</span>
                  <select
                    onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                    value={filters[filter.key] || ''}
                  >
                    <option value="">{filter.label}: Tất cả</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          {config.canCreate !== false ? (
            serviceCreateHref(config.endpoint) ? (
              <Link className="primary-button compact" to={serviceCreateHref(config.endpoint)!}>
                <Plus size={17} />
                Tạo phiếu
              </Link>
            ) : adminCrudFormCreateHref(config.endpoint) ? (
              <Link className="primary-button compact" to={adminCrudFormCreateHref(config.endpoint)!}>
                <Plus size={17} />
                Thêm mới
              </Link>
            ) : (
              <button className="primary-button compact" onClick={startCreate} type="button">
                <Plus size={17} />
                Thêm mới
              </button>
            )
          ) : null}
        </div>

        {isCustomerCrud ? (
          <div className="crud-table-wrap customer-table-wrap">
            <table className="customer-crud-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Mã</th>
                  <th>Tỉnh/TP</th>
                  <th>Liên hệ</th>
                  <th>Kỹ sư</th>
                  <th>Máy</th>
                  <th>Trạng thái</th>
                  {config.canUpdate !== false || config.canDelete !== false ? <th className="actions-column"></th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <CustomerTableRow
                    canDelete={config.canDelete !== false}
                    canUpdate={config.canUpdate !== false}
                    key={String(row.id ?? index)}
                    onDelete={() => setDeletingRow(row)}
                    onEdit={() => startEdit(row)}
                    onSelect={() => setSelectedRow(row)}
                    row={row}
                  />
                ))}
                {loading ? (
                  <tr>
                    <td colSpan={tableColumnCount}>
                      <div className="table-state">
                        <Loader2 className="spin-icon" size={18} />
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : null}
                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumnCount}>
                      <div className="table-state empty-state">
                        <strong>Không có dữ liệu phù hợp</strong>
                        <span>Thử đổi từ khóa tìm kiếm hoặc tạo mới {config.entityLabel}.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="crud-table-wrap">
            <table>
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  {config.canUpdate !== false || config.canDelete !== false ? <th className="actions-column"></th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    className="clickable-row"
                    key={String(row.id ?? index)}
                    onClick={() => setSelectedRow(row)}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                    tabIndex={0}
                  >
                    {config.columns.map((column) => (
                      <td key={column.key}>{renderTableValue(readPath(row, column.key), column.key)}</td>
                    ))}
                    {config.canUpdate !== false || config.canDelete !== false ? (
                      <td className="actions-cell">
                        <div className="row-actions">
                          {config.canUpdate !== false ? (
                            adminCrudFormEditHref(config.endpoint, row) ? (
                              <Link
                                className="icon-button"
                                onClick={(event) => event.stopPropagation()}
                                title="Sửa"
                                to={adminCrudFormEditHref(config.endpoint, row)!}
                              >
                                <Edit3 size={16} />
                              </Link>
                            ) : (
                              <button
                                className="icon-button"
                                onClick={(event) => handleActionClick(event, () => startEdit(row))}
                                title="Sửa"
                                type="button"
                              >
                                <Edit3 size={16} />
                              </button>
                            )
                          ) : null}
                          {config.canDelete !== false ? (
                            <button
                              className="icon-button danger"
                              onClick={(event) => handleActionClick(event, () => setDeletingRow(row))}
                              title="Xóa"
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {loading ? (
                  <tr>
                    <td colSpan={tableColumnCount}>
                      <div className="table-state">
                        <Loader2 className="spin-icon" size={18} />
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : null}
                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumnCount}>
                      <div className="table-state empty-state">
                        <strong>Không có dữ liệu phù hợp</strong>
                        <span>Thử đổi từ khóa tìm kiếm hoặc tạo mới {config.entityLabel}.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <div>
            {pagination ? (
              <span>
                Trang {pagination.page}/{Math.max(1, pagination.totalPages)} - {pagination.total} bản ghi
              </span>
            ) : (
              <span>{filteredRows.length} bản ghi</span>
            )}
          </div>

          <div className="pagination-controls">
            <label>
              Hiển thị
              <select onChange={(event) => handlePageSizeChange(event.target.value)} value={pageSize}>
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Trước
            </button>
            <button
              className="secondary-button"
              disabled={loading || page >= (pagination?.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      {selectedRow && isCustomerCrud ? (
        <CustomerQuickViewModal
          canDelete={config.canDelete !== false}
          canUpdate={config.canUpdate !== false}
          onClose={() => setSelectedRow(null)}
          onDelete={() => setDeletingRow(selectedRow)}
          onEdit={() => startEdit(selectedRow)}
          row={selectedRow}
        />
      ) : null}

      {selectedRow && !isCustomerCrud ? (
        <div className="detail-drawer-backdrop" onClick={() => setSelectedRow(null)} role="presentation">
          <aside aria-modal="true" className="detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>Chi tiết</span>
                <h2>{formatValue(readPath(selectedRow, config.columns[0]?.key || 'id'))}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedRow(null)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <dl className="detail-grid">
              {buildDetailItems(config, selectedRow, options).map((item, index) => (
                <div className="detail-item" key={`${item.label}-${index}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="drawer-actions">
              {config.canUpdate !== false ? (
                adminCrudFormEditHref(config.endpoint, selectedRow) ? (
                  <Link className="primary-button" to={adminCrudFormEditHref(config.endpoint, selectedRow)!}>
                    <Edit3 size={17} />
                    Sửa
                  </Link>
                ) : (
                  <button className="primary-button" onClick={() => startEdit(selectedRow)} type="button">
                    <Edit3 size={17} />
                    Sửa
                  </button>
                )
              ) : null}
              {config.canDelete !== false ? (
                <button className="danger-button" onClick={() => setDeletingRow(selectedRow)} type="button">
                  <Trash2 size={17} />
                  Xóa
                </button>
              ) : null}
              <button className="secondary-button" onClick={() => setSelectedRow(null)} type="button">
                Đóng
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crud-modal expanded-crud-modal" role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>{editingRow ? 'Sửa' : 'Thêm mới'}</span>
                <h2>{editingRow ? String(readPath(editingRow, config.columns[0]?.key || 'id')) : config.title}</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="admin-crud-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                {visibleFields(config.fields, Boolean(editingRow), form, options, config.endpoint, editingRow).map((field) => (
                  <FieldControl
                    accessoryMode={field.type === 'accessories' ? machineAccessoryMode(form, options, editingRow) : 'generic'}
                    field={field}
                    key={field.name}
                    onChange={(value, optionRow) => handleFieldChange(field, value, optionRow)}
                    options={options[field.name] || field.options || []}
                    row={editingRow}
                    value={form[field.name] ?? ''}
                  />
                ))}
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Lưu'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deletingRow ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog">
            <div>
              <span className="confirm-eyebrow">Xóa</span>
              <h2>{formatValue(readPath(deletingRow, config.columns[0]?.key || 'id'))}</h2>
              <p>Xóa {config.entityLabel} này nếu dữ liệu chưa bị ràng buộc.</p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeletingRow(null)} type="button">
                Hủy
              </button>
              <button className="danger-button" onClick={removeRow} type="button">
                Xóa
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

export function AdminCrudFormPage({ config }: { config: AdminCrudConfig }) {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const isEditing = Boolean(id);
  const [options, setOptions] = useState<OptionMap>({});
  const [row, setRow] = useState<TableRow | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const listPath = config.endpoint;
  const isCustomerForm = isCustomersEndpoint(config.endpoint);

  useEffect(() => {
    void loadForm();
  }, [config.endpoint, id]);

  useEffect(() => {
    if (loading || isEditing) return;
    const fields = visibleFields(config.fields, false, form, options, config.endpoint, null).filter((field) => field.previewCode);
    if (!fields.length) return;
    let cancelled = false;

    void applyPreviewCodes(fields, form, config.endpoint, options).then((previewValues) => {
      if (cancelled || !Object.keys(previewValues).length) return;
      setForm((current) => ({ ...current, ...previewValues }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    isEditing,
    config.endpoint,
    form.reportedAt,
    form.scheduledDate,
    form.installedAt,
    form.machineModelId,
    form.modelName,
    form.name,
  ]);

  async function loadForm() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const nextOptions = await loadOptions(config.fields);
      const nextRow = isEditing ? await apiFetch<TableRow>(`${config.endpoint}/${id}`) : null;
      setOptions(nextOptions);
      setRow(nextRow);
      setForm(buildInitialForm(visibleFields(config.fields, isEditing), nextRow, nextOptions, config.endpoint));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không tải được ${config.entityLabel}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(field: CrudField, value: string, optionRow?: TableRow) {
    setForm((current) => {
      const next = { ...current, [field.name]: value };

      if (field.name === 'machineId' && optionRow) {
        const customerId = readPath(optionRow, 'customer.id');
        const serialNumber = readPath(optionRow, 'serialNumber');
        const modelName = readPath(optionRow, 'modelName');
        const deviceName = readPath(optionRow, 'name');

        if (customerId && 'customerId' in current && !current.customerId) next.customerId = String(customerId);
        if (serialNumber && 'serialNumber' in current && !current.serialNumber) next.serialNumber = String(serialNumber);
        if (modelName && 'modelName' in current && !current.modelName) next.modelName = String(modelName);
        if (deviceName && 'deviceName' in current && !current.deviceName) next.deviceName = String(deviceName);
      }

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const fields = visibleFields(config.fields, isEditing, form, options, config.endpoint, row);
      const payloadFields = isEditing && isProductIndustriesEndpoint(config.endpoint)
        ? fields.filter((field) => field.name !== 'businessLinesText')
        : fields;
      const payload = isMachinesEndpoint(config.endpoint) ? buildMachinePayload(payloadFields, form, row) : buildPayload(payloadFields, form);

      if (isEditing) {
        await apiFetch(`${config.endpoint}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (isProductIndustriesEndpoint(config.endpoint)) {
          await syncProductIndustryBusinessLines(id, form.businessLinesText || '', row, form);
        }
        setSuccess(`Đã cập nhật ${config.entityLabel}.`);
      } else {
        await apiFetch(config.endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã tạo ${config.entityLabel}.`);
      }

      navigate(listPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không lưu được ${config.entityLabel}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Quản trị"
          title={isEditing ? `Sửa ${config.entityLabel}` : `Thêm ${config.entityLabel}`}
          description={config.description}
        />
        <button className="secondary-button" onClick={() => navigate(listPath)} type="button">
          <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className={isCustomerForm ? 'crud-form-page customer-form-page' : 'crud-form-page'}>
        <div className="form-panel-heading">
          <div>
            <span>{isEditing ? 'Sửa' : 'Thêm mới'}</span>
            <h2>{isEditing ? String(readPath(row ?? {}, config.columns[0]?.key || 'id') || config.title) : config.title}</h2>
          </div>
        </div>

        {loading ? (
          <div className="table-state">
            <Loader2 className="spin-icon" size={18} />
            Đang tải biểu mẫu...
          </div>
        ) : (
          <form className="admin-crud-form" onSubmit={handleSubmit}>
            {isCustomerForm ? (
              <GroupedCustomerFields
                fields={visibleFields(config.fields, isEditing, form, options, config.endpoint, row)}
                form={form}
                onFieldChange={handleFieldChange}
                options={options}
                row={row}
              />
            ) : (
              <div className="form-grid">
                {visibleFields(config.fields, isEditing, form, options, config.endpoint, row).map((field) => (
                  <FieldControl
                    accessoryMode={field.type === 'accessories' ? machineAccessoryMode(form, options, row) : 'generic'}
                    field={field}
                    key={field.name}
                    onChange={(value, optionRow) => handleFieldChange(field, value, optionRow)}
                    options={options[field.name] || field.options || []}
                    row={row}
                    value={form[field.name] ?? ''}
                  />
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => navigate(listPath)} type="button">
                Hủy
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                {saving ? 'Đang lưu' : 'Lưu'}
              </button>
            </div>
          </form>
        )}
      </section>
    </PageFrame>
  );
}

function FieldControl({
  accessoryMode,
  field,
  value,
  options,
  row,
  onChange,
}: {
  accessoryMode?: 'probe' | 'endoscopy' | 'generic';
  field: CrudField;
  value: string;
  options: SelectOption[];
  row?: TableRow | null;
  onChange: (value: string, optionRow?: TableRow) => void;
}) {
  if (field.type === 'businessLines') {
    return (
      <div className="wide-field">
        <span className="field-label">{field.label}</span>
        <InitialBusinessLinesEditor onChange={onChange} value={value} />
      </div>
    );
  }

  if (field.type === 'textarea' || field.type === 'tags') {
    return (
      <label className="wide-field">
        {field.label}
      <textarea
          onChange={(event) => onChange(event.target.value)}
          placeholder={textareaPlaceholder(field)}
          required={field.required}
          value={value}
        />
      </label>
    );
  }

  if (field.type === 'accessories') {
    if (accessoryMode === 'probe' || accessoryMode === 'endoscopy') {
      return (
        <div className="wide-field">
          <span className="field-label">{field.label}</span>
          <MachineAccessoryEditor mode={accessoryMode} onChange={onChange} value={value} />
        </div>
      );
    }

    return (
      <label className="wide-field">
        {field.label}
        <textarea
          onChange={(event) => onChange(event.target.value)}
          placeholder="Mỗi dòng: Tên phụ kiện | S/N"
          value={formatMachineAccessoriesText(value)}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    if (field.optionSource?.searchable) {
      return (
        <SearchableSelect
          field={field}
          onChange={onChange}
          options={options}
          row={row}
          value={value}
        />
      );
    }

    return (
      <label className={field.wide ? 'wide-field' : undefined}>
        {field.label}
        <select onChange={(event) => onChange(event.target.value)} required={field.required} value={value}>
          {!field.required ? <option value="">Không chọn</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={field.wide ? 'wide-field' : undefined}>
      {field.label}
      <input
        disabled={field.autoGenerated}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.autoGenerated ? field.placeholder || 'Đang sinh mã...' : field.placeholder}
        required={field.required}
        type={inputType(field)}
        value={value}
      />
      {field.type === 'image' && value ? (
        <span className="image-field-preview">
          <img alt="" src={value} />
        </span>
      ) : null}
    </label>
  );
}

function InitialBusinessLinesEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseInitialBusinessLinesForEditor(value);
  const editableRows = rows.length ? rows : [emptyInitialBusinessLineRow()];

  function setRows(nextRows: InitialBusinessLineRow[]) {
    onChange(serializeInitialBusinessLinesForEditor(nextRows));
  }

  function updateRow(index: number, patch: Partial<InitialBusinessLineRow>) {
    setRows(editableRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows(editableRows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="initial-business-lines-editor">
      <div className="initial-business-lines-header">
        <span>Nhóm sản phẩm thuộc ngành hàng này</span>
        <button className="secondary-button compact" onClick={() => setRows([...editableRows, emptyInitialBusinessLineRow()])} type="button">
          <Plus size={15} />
          Thêm nhóm
        </button>
      </div>
      <div className="initial-business-lines-rows">
        {editableRows.map((row, index) => (
          <div className="initial-business-line-row" key={index}>
            <input
              onChange={(event) => updateRow(index, { code: event.target.value })}
              placeholder="Mã nhóm"
              value={row.code}
            />
            <input
              onChange={(event) => updateRow(index, { name: event.target.value })}
              placeholder="Tên nhóm sản phẩm"
              value={row.name}
            />
            <select onChange={(event) => updateRow(index, { productCategory: event.target.value })} value={row.productCategory}>
              {initialBusinessLineCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              onChange={(event) => updateRow(index, { manufacturer: event.target.value })}
              placeholder="Hãng"
              value={row.manufacturer}
            />
            <input
              onChange={(event) => updateRow(index, { countryOfOrigin: event.target.value })}
              placeholder="Xuất xứ"
              value={row.countryOfOrigin}
            />
            <button
              className="icon-button"
              disabled={editableRows.length === 1 && !hasInitialBusinessLineValue(row)}
              onClick={() => removeRow(index)}
              title="Xóa nhóm"
              type="button"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <p className="field-hint">Dùng cho model.</p>
    </div>
  );
}

function SearchableSelect({
  field,
  value,
  options,
  row,
  onChange,
}: {
  field: CrudField;
  value: string;
  options: SelectOption[];
  row?: TableRow | null;
  onChange: (value: string, optionRow?: TableRow) => void;
}) {
  const [search, setSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<SelectOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const source = field.optionSource!;
  const selectedOption =
    [...remoteOptions, ...options].find((option) => option.value === value) || optionFromRow(field, row);

  useEffect(() => {
    if (!isOpen) return;

    const timeout = window.setTimeout(() => {
      loadRemoteOptions();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [isOpen, search, source.endpoint]);

  async function loadRemoteOptions() {
    setLoadingOptions(true);

    try {
      const endpoint = withQueryParams(source.endpoint, {
        limit: '20',
        search: search.trim(),
      });
      const result = await apiFetch<Paginated<TableRow> | TableRow[]>(endpoint);
      const rows = filterOptionRows(Array.isArray(result) ? result : result.data, source.filterPath, source.filterValues);
      const nextOptions = rows
        .map((item) => ({
          label: buildOptionLabel(item, source.labelPaths, source.labelPath),
          row: item,
          value: String(readPath(item, source.valuePath) ?? ''),
        }))
        .filter((option) => option.label && option.value);

      setRemoteOptions(mergeOptions(selectedOption ? [selectedOption, ...nextOptions] : nextOptions));
    } catch {
      setRemoteOptions(selectedOption ? [selectedOption] : []);
    } finally {
      setLoadingOptions(false);
    }
  }

  function chooseOption(option: SelectOption) {
    onChange(option.value, option.row);
    setSearch(option.label);
    setIsOpen(false);
  }

  function clearValue() {
    onChange('');
    setSearch('');
    setIsOpen(false);
  }

  const visibleOptions = mergeOptions(selectedOption ? [selectedOption, ...remoteOptions] : remoteOptions);
  const inputValue = isOpen ? search : selectedOption?.label || '';

  return (
    <div className={field.wide ? 'searchable-field wide-field' : 'searchable-field'}>
      <span className="field-label">{field.label}</span>
      <div className="searchable-select">
        <div className="searchable-input-row">
          <input
            onBlur={() => {
              window.setTimeout(() => {
                setSearch('');
                setIsOpen(false);
              }, 160);
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setSearch('');
              setIsOpen(true);
            }}
            placeholder={`Tìm ${field.label.toLowerCase()}...`}
            value={inputValue}
          />
          {value && !field.required ? (
            <button className="secondary-button searchable-clear" onClick={clearValue} type="button">
              Bỏ chọn
            </button>
          ) : null}
        </div>
        {field.required && !value ? <input className="searchable-required-proxy" required value="" onChange={() => null} /> : null}
        {isOpen ? (
          <div className="searchable-menu">
            {loadingOptions ? <div className="searchable-state">Đang tìm...</div> : null}
            {!loadingOptions && visibleOptions.length === 0 ? (
              <div className="searchable-state">Không có kết quả. Hãy gõ mã, tên, S/N hoặc khách hàng.</div>
            ) : null}
            {!loadingOptions
              ? visibleOptions.map((option) => (
                  <button
                    className={option.value === value ? 'active' : ''}
                    key={option.value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseOption(option)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    {option.row ? <span>{optionContext(option.row)}</span> : null}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="customer-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CustomerQuickViewModal({
  row,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  row: TableRow;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const id = String(readPath(row, 'id') ?? '');
  const name = formatDisplayValue(readPath(row, 'hospitalName') || readPath(row, 'name'));
  const code = formatDisplayValue(readPath(row, 'customerCode'));
  const type = displayLabel(String(readPath(row, 'customerType') ?? ''));
  const address = [readPath(row, 'address'), readPath(row, 'district'), readPath(row, 'province')]
    .filter(Boolean)
    .map((value) => String(value))
    .join(', ');
  const phone = formatDisplayValue(readPath(row, 'contactPhone') || readPath(row, 'phone'));
  const contact = formatDisplayValue(readPath(row, 'contactPerson'));
  const region = formatDisplayValue(readPath(row, 'region.name'));
  const engineer = formatDisplayValue(readPath(row, 'primaryEngineer.fullName') || readPath(row, 'primaryEngineer.email'));
  const machineCount = Number(readPath(row, '_count.machines') ?? 0);

  return (
    <div className="customer-quick-backdrop" onClick={onClose} role="presentation">
      <section aria-modal="true" className="customer-quick-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="customer-quick-header">
          <div>
            <span>Hồ sơ nhanh</span>
            <h2>{name}</h2>
            <p>{[code !== '-' ? code : '', type].filter(Boolean).join(' - ') || 'Chưa phân loại'}</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Đóng" type="button">
            <X size={17} />
          </button>
        </header>

        <div className="customer-quick-body">
          <section className="customer-quick-panel">
            <h3>Liên hệ</h3>
            <div className="customer-quick-grid">
              <CustomerQuickField label="Người liên hệ" value={contact} />
              <CustomerQuickField label="Số điện thoại" value={phone} />
              <CustomerQuickField label="Khu vực" value={region} />
              <CustomerQuickField label="Địa chỉ" value={address || 'Chưa có địa chỉ'} />
            </div>
          </section>

          <section className="customer-quick-side">
            <CustomerQuickField label="Kỹ sư phụ trách" value={engineer === '-' ? 'Chưa gán kỹ sư' : engineer} />
            <CustomerQuickField label="Số máy" value={`${machineCount} máy`} />
            <div className="customer-quick-status">
              <span>Trạng thái</span>
              {renderStatusBadge(readPath(row, 'status'))}
            </div>
          </section>
        </div>

        <footer className="customer-quick-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Đóng
          </button>
          {id ? (
            <Link className="primary-button" to={`/customers/profile?customerId=${id}`}>
              Hồ sơ đầy đủ
            </Link>
          ) : null}
          {canUpdate ? (
            <button className="secondary-button" onClick={onEdit} type="button">
              <Edit3 size={16} />
              Sửa
            </button>
          ) : null}
          {canDelete ? (
            <button className="danger-button" onClick={onDelete} type="button">
              <Trash2 size={16} />
              Xóa
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function CustomerQuickField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="customer-quick-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CustomerTableRow({
  row,
  canUpdate,
  canDelete,
  onSelect,
  onEdit,
  onDelete,
}: {
  row: TableRow;
  canUpdate: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const editHref = adminCrudFormEditHref('/customers', row);
  const name = formatDisplayValue(readPath(row, 'hospitalName') || readPath(row, 'name'));
  const code = formatDisplayValue(readPath(row, 'customerCode'));
  const type = displayLabel(String(readPath(row, 'customerType') ?? ''));
  const address = [readPath(row, 'address'), readPath(row, 'district'), readPath(row, 'province')]
    .filter(Boolean)
    .map((value) => String(value))
    .join(', ');
  const province = formatDisplayValue(readPath(row, 'province'));
  const phone = formatDisplayValue(readPath(row, 'contactPhone') || readPath(row, 'phone'));
  const contact = formatDisplayValue(readPath(row, 'contactPerson'));
  const engineer = formatDisplayValue(readPath(row, 'primaryEngineer.fullName'));
  const machineCount = Number(readPath(row, '_count.machines') ?? 0);
  const profileHref = `/customers/profile?customerId=${String(readPath(row, 'id') ?? '')}`;
  const handleCustomerAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    action();
  };

  return (
    <tr
      className="clickable-row customer-table-row"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
    >
      <td>
        <div className="customer-name-cell customer-name-cell--compact">
          <strong>{name}</strong>
          <span>{type || 'Chưa phân loại'}</span>
          {address ? <small>{address}</small> : null}
        </div>
      </td>
      <td>
        <span className="customer-code-cell">{code}</span>
      </td>
      <td>{province}</td>
      <td>
        <div className="customer-stack-cell customer-stack-cell--compact">
          <strong>{contact}</strong>
          <small>{phone}</small>
        </div>
      </td>
      <td>{engineer === '-' ? <span className="muted-text">Chưa gán</span> : engineer}</td>
      <td>
        <span className="customer-machine-count">{machineCount} máy</span>
      </td>
      <td>{renderStatusBadge(readPath(row, 'status'))}</td>
      {canUpdate || canDelete ? (
        <td className="actions-cell customer-table-actions">
          <div className="row-actions">
            <Link className="customer-profile-link" onClick={(event) => event.stopPropagation()} to={profileHref}>
              Hồ sơ
            </Link>
            {canUpdate ? (
              editHref ? (
                <Link className="icon-button" onClick={(event) => event.stopPropagation()} title="Sửa" to={editHref}>
                  <Edit3 size={16} />
                </Link>
              ) : (
                <button className="icon-button" onClick={(event) => handleCustomerAction(event, onEdit)} title="Sửa" type="button">
                  <Edit3 size={16} />
                </button>
              )
            ) : null}
            {canDelete ? (
              <button className="icon-button danger" onClick={(event) => handleCustomerAction(event, onDelete)} title="Xóa" type="button">
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function GroupedCustomerFields({
  fields,
  form,
  options,
  row,
  onFieldChange,
}: {
  fields: CrudField[];
  form: FormState;
  options: OptionMap;
  row: TableRow | null;
  onFieldChange: (field: CrudField, value: string, optionRow?: TableRow) => void;
}) {
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const rendered = new Set<string>();
  const groups = [
    {
      title: 'Thông tin chính',
      description: 'Tên, mã, phụ trách.',
      fields: ['name', 'hospitalName', 'shortName', 'customerCode', 'customerType', 'status', 'regionId', 'primaryEngineerId'],
    },
    {
      title: 'Liên hệ',
      description: 'Kênh liên hệ.',
      fields: ['phone', 'email', 'taxCode', 'contactPerson', 'contactPhone', 'contactEmail'],
    },
    {
      title: 'Địa chỉ',
      description: 'Địa chỉ làm việc.',
      fields: ['province', 'district', 'ward', 'address', 'fullAddress'],
    },
    {
      title: 'Ghi chú',
      description: 'Các lưu ý nội bộ về khách hàng.',
      fields: ['note'],
    },
  ];

  return (
    <div className="customer-form-sections">
      {groups.map((group) => {
        const groupFields = group.fields.map((name) => fieldMap.get(name)).filter(Boolean) as CrudField[];
        if (!groupFields.length) return null;
        groupFields.forEach((field) => rendered.add(field.name));

        return (
          <section className="customer-form-section" key={group.title}>
            <div className="customer-form-section-heading">
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            {group.title === 'Địa chỉ' ? (
              <CustomerAddressFields
                fieldMap={fieldMap}
                form={form}
                onFieldChange={onFieldChange}
              />
            ) : (
              <div className="form-grid">
                {groupFields.map((field) => (
                  <FieldControl
                    field={field}
                    key={field.name}
                    onChange={(value, optionRow) => onFieldChange(field, value, optionRow)}
                    options={options[field.name] || field.options || []}
                    row={row}
                    value={form[field.name] ?? ''}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
      {fields.some((field) => !rendered.has(field.name)) ? (
        <section className="customer-form-section">
          <div className="customer-form-section-heading">
            <h3>Thông tin khác</h3>
            <p>Các trường bổ sung của hồ sơ khách hàng.</p>
          </div>
          <div className="form-grid">
            {fields
              .filter((field) => !rendered.has(field.name))
              .map((field) => (
                <FieldControl
                  field={field}
                  key={field.name}
                  onChange={(value, optionRow) => onFieldChange(field, value, optionRow)}
                  options={options[field.name] || field.options || []}
                  row={row}
                  value={form[field.name] ?? ''}
                />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CustomerAddressFields({
  fieldMap,
  form,
  onFieldChange,
}: {
  fieldMap: Map<string, CrudField>;
  form: FormState;
  onFieldChange: (field: CrudField, value: string) => void;
}) {
  const addressValue = {
    address: form.address ?? '',
    district: form.district ?? '',
    province: form.province ?? '',
    ward: form.ward ?? '',
  };
  const fullAddress = buildFullVietnamAddress(addressValue);

  function patchAddress(patch: Partial<typeof addressValue>) {
    const nextValue = { ...addressValue, ...patch };
    const fieldsToUpdate: Array<[string, string]> = [
      ['province', nextValue.province],
      ['district', nextValue.district],
      ['ward', nextValue.ward],
      ['address', nextValue.address],
      ['fullAddress', buildFullVietnamAddress(nextValue)],
    ];

    fieldsToUpdate.forEach(([name, value]) => {
      const field = fieldMap.get(name);
      if (field) onFieldChange(field, value);
    });
  }

  return (
    <div className="form-grid">
      <VietnamAddressSelects onChange={patchAddress} value={addressValue} />
      <div className="wide-field flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dbe6f3] bg-white px-4 py-3 text-sm font-semibold text-[#667985]">
        <span className="min-w-0 flex-1 truncate">{fullAddress || 'Chọn đủ địa chỉ để mở Google Maps nhanh.'}</span>
        {fullAddress ? <GoogleMapsDirectionsButton address={fullAddress} className="secondary-button compact" /> : null}
      </div>
    </div>
  );
}

function buildDetailItems(config: AdminCrudConfig, row: TableRow, options: OptionMap) {
  const items: Array<{ label: string; value: ReactNode }> = [];
  const usedLabels = new Set<string>();
  const usedKeys = new Set<string>();

  config.columns.forEach((column) => {
    const value = renderDetailValue(readPath(row, column.key), column.key);
    items.push({ label: column.label, value });
    usedLabels.add(column.label);
    usedKeys.add(column.key);
  });

  config.fields.forEach((field) => {
    const key = field.valuePath || field.name;
    if (usedLabels.has(field.label) || usedKeys.has(key)) return;
    items.push({ label: field.label, value: formatFieldDetailValue(field, row, options) });
    usedLabels.add(field.label);
    usedKeys.add(key);
  });

  return items;
}

function formatFieldDetailValue(field: CrudField, row: TableRow, options: OptionMap): ReactNode {
  const rawValue = readPath(row, field.valuePath || field.name);

  if (field.type === 'image') {
    return renderDetailValue(rawValue, field.name);
  }

  if (field.type === 'select') {
    const value = rawValue == null ? '' : String(rawValue);
    const matchedOption = [...(options[field.name] || []), ...(field.options || [])].find((option) => option.value === value);
    return matchedOption?.label || optionFromRow(field, row)?.label || formatDisplayValue(rawValue);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.length ? rawValue.map((item) => formatDisplayValue(item)).join(', ') : '-';
  }

  return formatDisplayValue(rawValue);
}

function renderTableValue(value: unknown, key: string) {
  if (isStatusKey(key)) return renderStatusBadge(value);
  if (!isImageKey(key)) return formatDisplayValue(value);
  if (!value || typeof value !== 'string') return '-';
  return <ImagePreview className="table-image" src={value} />;
}

function renderDetailValue(value: unknown, key: string) {
  if (isStatusKey(key)) return renderStatusBadge(value);
  if (!isImageKey(key)) return formatDisplayValue(value);
  if (!value || typeof value !== 'string') return '-';

  return (
    <span className="detail-image">
      <ImagePreview className="detail-image-frame" src={value} />
    </span>
  );
}

function ImagePreview({ className, src }: { className?: string; src: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span className={className ? `${className} image-fallback` : 'image-fallback'}>
        <ImageOff size={18} />
      </span>
    );
  }

  return (
    <span className={className}>
      <img alt="" onError={() => setHasError(true)} src={src} />
    </span>
  );
}

function isImageKey(key: string) {
  return /(^|\.)(imageUrl|photoUrl|avatarUrl|logoUrl)$/i.test(key);
}

function isStatusKey(key: string) {
  return /(^|\.)(status|state|priority)$/i.test(key);
}

function renderStatusBadge(value: unknown) {
  const label = formatDisplayValue(value);
  if (label === '-') return label;
  const tone = statusTone(label);

  return <span className={`status-badge ${tone}`}>{label}</span>;
}

function statusTone(label: string) {
  const normalized = label.toLowerCase();

  if (/active|done|complete|completed|success|approved|resolved|verified|đang hoạt động|hoàn thành|đã duyệt|đã xử lý|đã xác nhận/.test(normalized)) {
    return 'good';
  }

  if (/inactive|locked|cancel|cancelled|rejected|failed|error|urgent|khẩn|tạm ngưng|tạm khóa|hủy|từ chối|lỗi|thất bại/.test(normalized)) {
    return 'danger';
  }

  if (/pending|progress|processing|assigned|scheduled|waiting|maintenance|repairing|high|needs_update|chờ|đang|sắp|bảo trì|sửa|đã phân công|cao|cần bổ sung/.test(normalized)) {
    return 'warn';
  }

  return 'neutral';
}

function buildQuickFilters(config: AdminCrudConfig, rows: TableRow[]) {
  return config.columns
    .filter((column) => quickFilterKeys.includes(column.key) || isStatusKey(column.key))
    .map((column) => ({
      key: column.key,
      label: column.label,
      options: uniqueOptionsForColumn(column.key, rows),
    }))
    .filter((filter) => filter.options.length > 0);
}

function uniqueOptionsForColumn(key: string, rows: TableRow[]) {
  const options = new Map<string, string>();

  rows.forEach((row) => {
    const rawValue = readPath(row, key);
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    const value = String(rawValue);
    options.set(value, formatDisplayValue(rawValue));
  });

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

function applyColumnFilters(rows: TableRow[], filters: FilterState) {
  const activeFilters = Object.entries(filters).filter(([, value]) => value);
  if (!activeFilters.length) return rows;

  return rows.filter((row) =>
    activeFilters.every(([key, value]) => {
      const rawValue = readPath(row, key);
      return rawValue !== null && rawValue !== undefined && String(rawValue) === value;
    }),
  );
}

function formatDisplayValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (!value.length) return '-';
    return value.map((item) => formatDisplayValue(item)).join(', ');
  }

  if (value && typeof value === 'object') {
    return formatObjectValue(value as Record<string, unknown>);
  }

  const formatted = formatValue(value);
  return displayLabel(typeof value === 'string' ? value : formatted);
}

function formatObjectValue(value: Record<string, unknown>): string {
  const itemName = value.itemName || value.name || value.title;
  const model = value.model ? `Model ${String(value.model)}` : '';
  const serialNumber = value.serialNumber ? `S/N ${String(value.serialNumber)}` : '';
  const quantity = value.quantity ? `SL ${String(value.quantity)}` : '';
  const warrantyPeriod = value.warrantyPeriod ? `BH ${String(value.warrantyPeriod)}` : '';
  const manufactureDate = value.manufactureDate ? `NSX ${formatValue(value.manufactureDate)}` : '';
  const summary = [itemName, model, serialNumber, manufactureDate, quantity, warrantyPeriod].filter(Boolean).join(' - ');

  return summary || JSON.stringify(value);
}

function inputType(field: CrudField) {
  if (field.type === 'image') return 'url';
  return field.type || 'text';
}

async function loadRows(endpoint: string, page: number, limit: number, search: string, extraQueryParams: Record<string, string> = {}) {
  const endpointWithQuery = withQueryParams(endpoint, {
    ...extraQueryParams,
    limit: String(limit),
    page: String(page),
    search,
  });
  const result = await apiFetch<Paginated<TableRow> | TableRow[]>(endpointWithQuery);

  if (Array.isArray(result)) {
    return { rows: result, pagination: null };
  }

  return {
    rows: result.data,
    pagination: result.meta,
  };
}

async function loadOptions(fields: CrudField[]) {
  const entries = await Promise.all(
    fields
      .filter((field) => field.optionSource && !field.optionSource.searchable)
      .map(async (field) => {
        const source = field.optionSource!;
        const result = await apiFetch<Paginated<TableRow> | TableRow[]>(source.endpoint);
        const rows = filterOptionRows(Array.isArray(result) ? result : result.data, source.filterPath, source.filterValues);
        return [
          field.name,
          rows.map((row) => ({
            label: buildOptionLabel(row, source.labelPaths, source.labelPath),
            row,
            value: String(readPath(row, source.valuePath) ?? ''),
          })).filter((option) => option.label && option.value),
        ] as const;
      }),
  );

  return Object.fromEntries(entries);
}

function buildOptionLabel(row: TableRow, labelPaths: string[] | undefined, fallbackPath: string) {
  const values = (labelPaths?.length ? labelPaths : [fallbackPath])
    .map((path) => readPath(row, path))
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value));

  return values.length ? values.join(' - ') : String(readPath(row, 'email') ?? '');
}

function optionFromRow(field: CrudField, row?: TableRow | null): SelectOption | undefined {
  if (!row || !field.optionSource || !field.valuePath) return undefined;

  const value = readPath(row, field.valuePath);
  if (value === null || value === undefined || value === '') return undefined;

  const relationPath = field.valuePath.split('.').slice(0, -1).join('.');
  const relationRow = relationPath ? readPath(row, relationPath) : row;
  const labelRow = relationRow && typeof relationRow === 'object' ? (relationRow as TableRow) : row;

  return {
    label: buildOptionLabel(labelRow, field.optionSource.labelPaths, field.optionSource.labelPath),
    row: labelRow,
    value: String(value),
  };
}

function mergeOptions(options: SelectOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function optionContext(row: TableRow) {
  const values = [
    readPath(row, 'customer.name'),
    readPath(row, 'region.name'),
    readPath(row, 'province'),
    readPath(row, 'inventoryStatus'),
    readPath(row, 'status'),
    readPath(row, 'productCategory'),
  ]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => displayLabel(String(value)));

  return values.length ? values.join(' / ') : '';
}

function filterOptionRows(rows: TableRow[], filterPath?: string, filterValues?: string[]) {
  if (!filterPath || !filterValues?.length) return rows;
  const allowedValues = filterValues.map(normalizeText);

  return rows.filter((row) => allowedValues.includes(normalizeText(readPath(row, filterPath))));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function buildInitialForm(fields: CrudField[], row: TableRow | null, options: OptionMap, endpoint?: string) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!row) {
        if (field.autoGenerated) return [field.name, ''];
        return [field.name, field.required ? (options[field.name]?.[0]?.value || field.options?.[0]?.value || '') : ''];
      }

      if (isMachinesEndpoint(endpoint) && field.name === 'accessories') {
        return [field.name, serializeMachineAccessories(readPath(row, 'accessories'))];
      }

      const rawValue = readPath(row, field.valuePath || field.name);
      if (field.name === 'businessLinesText' && isProductIndustriesEndpoint(endpoint)) {
        return [field.name, serializeInitialBusinessLinesForEditor(readInitialBusinessLines(row))];
      }
      if (Array.isArray(rawValue)) {
        return [field.name, rawValue.join('\n')];
      }
      if (field.type === 'date' && typeof rawValue === 'string') {
        return [field.name, rawValue.slice(0, 10)];
      }

      return [field.name, rawValue == null ? '' : String(rawValue)];
    }),
  );
}

async function applyPreviewCodes(fields: CrudField[], form: FormState, endpoint?: string, options?: OptionMap) {
  const previews: FormState = {};

  for (const field of fields) {
    if (!field.previewCode) continue;
    const code = await fetchPreviewCode(field.previewCode, form, endpoint, options);
    if (code && form[field.name] !== code) {
      previews[field.name] = code;
    }
  }

  return previews;
}

async function fetchPreviewCode(kind: NonNullable<CrudField['previewCode']>, form: FormState, endpoint?: string, options?: OptionMap) {
  const params = new URLSearchParams();

  if (kind === 'repair') {
    if (form.reportedAt) params.set('date', form.reportedAt);
    return readPreviewCode(`/repairs/next-code?${params.toString()}`);
  }

  if (kind === 'maintenance') {
    if (form.scheduledDate) params.set('date', form.scheduledDate);
    return readPreviewCode(`/maintenance/next-code?${params.toString()}`);
  }

  if (kind === 'installation') {
    if (form.installedAt) params.set('date', form.installedAt);
    return readPreviewCode(`/installations/next-code?${params.toString()}`);
  }

  if (kind === 'componentAccessory') {
    if (!form.machineModelId) return '';
    params.set('machineModelId', form.machineModelId);
    return readPreviewCode(`/component-accessories/next-code?${params.toString()}`);
  }

  const source = previewMachineSource(form, endpoint, options);
  if (source) params.set('source', source);
  return readPreviewCode(`/machines/next-code?${params.toString()}`);
}

async function readPreviewCode(path: string) {
  const result = await apiFetch<{ code?: string | null }>(path);
  return result.code || '';
}

function previewMachineSource(form: FormState, endpoint?: string, options?: OptionMap) {
  if (form.machineModelId) {
    const model = options?.machineModelId?.find((option) => option.value === form.machineModelId)?.row;
    return String(readPath(model ?? {}, 'code') || readPath(model ?? {}, 'name') || form.modelName || form.name || 'MAY');
  }
  return form.modelName || form.name || (isMachinesEndpoint(endpoint) ? 'MAY' : '');
}

function buildPayload(fields: CrudField[], form: FormState) {
  const payload: Record<string, unknown> = {};

  fields.forEach((field) => {
    if (field.autoGenerated) return;
    const value = form[field.name]?.trim() ?? '';
    if (!value && !field.required) {
      if (field.nullable) payload[field.name] = null;
      return;
    }
    if (field.name === 'businessLinesText') {
      const businessLines = parseInitialBusinessLines(value);
      if (businessLines.length) payload.businessLines = businessLines;
      return;
    }
    payload[field.name] = field.type === 'tags' ? value.split('\n').map((item) => item.trim()).filter(Boolean) : value;
  });

  return payload;
}

function parseInitialBusinessLines(value: string) {
  return parseInitialBusinessLinesForEditor(value)
    .filter((line) => line.code && line.name)
    .map((line) =>
      Object.fromEntries(
        Object.entries(line).filter(([, fieldValue]) => fieldValue),
      ),
    );
}

function parseInitialBusinessLinesForEditor(value: string): InitialBusinessLineRow[] {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as InitialBusinessLineRow[];
    if (Array.isArray(parsed)) {
      return parsed.map((row) => ({
        code: String(row?.code ?? '').trim(),
        countryOfOrigin: String(row?.countryOfOrigin ?? '').trim(),
        id: typeof row?.id === 'string' ? row.id : undefined,
        manufacturer: String(row?.manufacturer ?? '').trim(),
        name: String(row?.name ?? '').trim(),
        productCategory: normalizeInitialBusinessLineCategory(row?.productCategory),
      }));
    }
  } catch {
    // Keep supporting the old pasted text format while the UI now uses rows.
  }

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code = '', name = '', productCategory = '', manufacturer = '', countryOfOrigin = ''] = line.split('|').map((part) => part.trim());
      return {
        code,
        countryOfOrigin,
        manufacturer,
        name,
        productCategory: normalizeInitialBusinessLineCategory(productCategory),
      };
    });
}

function serializeInitialBusinessLines(rows: InitialBusinessLineRow[]) {
  const normalized = rows
    .map((row) => ({
      code: row.code.trim(),
      countryOfOrigin: row.countryOfOrigin.trim(),
      id: row.id,
      manufacturer: row.manufacturer.trim(),
      name: row.name.trim(),
      productCategory: normalizeInitialBusinessLineCategory(row.productCategory),
    }))
    .filter(hasInitialBusinessLineValue);

  return normalized.length ? JSON.stringify(normalized) : '';
}

function serializeInitialBusinessLinesForEditor(rows: InitialBusinessLineRow[]) {
  const normalized = rows.map((row) => ({
    code: row.code.trim(),
    countryOfOrigin: row.countryOfOrigin.trim(),
    id: row.id,
    manufacturer: row.manufacturer.trim(),
    name: row.name.trim(),
    productCategory: normalizeInitialBusinessLineCategory(row.productCategory),
  }));

  return normalized.some(hasInitialBusinessLineValue) ? JSON.stringify(normalized) : '';
}

function emptyInitialBusinessLineRow(): InitialBusinessLineRow {
  return {
    code: '',
    countryOfOrigin: '',
    manufacturer: '',
    name: '',
    productCategory: 'OTHER',
  };
}

function readInitialBusinessLines(row: TableRow | null): InitialBusinessLineRow[] {
  const businessLines = readPath(row ?? {}, 'businessLines');
  if (!Array.isArray(businessLines)) return [];

  return businessLines
    .filter((line): line is TableRow => Boolean(line && typeof line === 'object'))
    .map((line) => ({
      code: String(readPath(line, 'code') ?? '').trim(),
      countryOfOrigin: String(readPath(line, 'countryOfOrigin') ?? '').trim(),
      id: String(readPath(line, 'id') ?? '').trim() || undefined,
      manufacturer: String(readPath(line, 'manufacturer') ?? '').trim(),
      name: String(readPath(line, 'name') ?? '').trim(),
      productCategory: normalizeInitialBusinessLineCategory(String(readPath(line, 'productCategory') ?? '')),
    }));
}

async function syncProductIndustryBusinessLines(industryId: string, value: string, currentRow: TableRow | null, form: FormState) {
  const existingRows = readInitialBusinessLines(currentRow);
  const existingIds = new Set(existingRows.map((line) => line.id).filter((id): id is string => Boolean(id)));
  const nextRows = parseInitialBusinessLinesForEditor(value).filter((line) => line.code && line.name);
  const nextIds = new Set(nextRows.map((line) => line.id).filter((id): id is string => Boolean(id)));

  for (const line of nextRows) {
    const payload = {
      code: line.code,
      countryOfOrigin: line.countryOfOrigin || null,
      expertiseGroup: form.expertiseGroup || undefined,
      manufacturer: line.manufacturer || null,
      name: line.name,
      productCategory: normalizeInitialBusinessLineCategory(line.productCategory),
      productIndustryId: industryId,
    };

    if (line.id && existingIds.has(line.id)) {
      await apiFetch(`/business-lines/${line.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/business-lines', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  }

  for (const existing of existingRows) {
    if (!existing.id || nextIds.has(existing.id)) continue;
    await apiFetch(`/business-lines/${existing.id}`, { method: 'DELETE' });
  }
}

function hasInitialBusinessLineValue(row: InitialBusinessLineRow) {
  return Boolean(row.code || row.name || row.manufacturer || row.countryOfOrigin || (row.productCategory && row.productCategory !== 'OTHER'));
}

function normalizeInitialBusinessLineCategory(value?: string | null) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return initialBusinessLineCategoryOptions.some((option) => option.value === normalized) ? normalized : 'OTHER';
}

function buildMachinePayload(fields: CrudField[], form: FormState, editingRow: TableRow | null) {
  const payload = buildPayload(
    fields.filter((field) => field.name !== 'accessories'),
    form,
  );

  payload.accessories = parseMachineAccessoriesForm(
    form.accessories ?? '',
    Array.isArray(editingRow?.accessories) ? editingRow.accessories : [],
  );

  return payload;
}

function parseMachineAccessoriesForm(value: string, existingAccessories: unknown[]) {
  return parseMachineAccessoriesInput(value, existingAccessories);
}

function textareaPlaceholder(field: CrudField) {
  if (field.type === 'tags') return 'Mỗi dòng là một mục';
  return undefined;
}

function isMachinesEndpoint(endpoint?: string) {
  return endpoint === '/machines';
}

function isProductIndustriesEndpoint(endpoint?: string) {
  return endpoint === '/product-industries';
}

function isCustomersEndpoint(endpoint?: string) {
  return endpoint === '/customers';
}

function buildCustomerStats(rows: TableRow[]): CustomerStats {
  return rows.reduce(
    (stats: CustomerStats, row) => {
      if (String(readPath(row, 'status') ?? '').toUpperCase() === 'ACTIVE') stats.active += 1;
      if (readPath(row, 'primaryEngineer.id') || readPath(row, 'primaryEngineer.fullName')) stats.assigned += 1;
      if (Number(readPath(row, '_count.machines') ?? 0) > 0) stats.withMachines += 1;
      return stats;
    },
    { active: 0, assigned: 0, withMachines: 0 },
  );
}

function serviceCreateHref(endpoint?: string) {
  if (endpoint === '/repairs') return '/service-tickets/create?kind=repair';
  if (endpoint === '/maintenance') return '/service-tickets/create?kind=maintenance';
  if (endpoint === '/installations') return '/installations/create';
  return '';
}

function adminCrudFormCreateHref(endpoint?: string) {
  if (endpoint === '/customers') return '/customers/new';
  if (endpoint === '/product-industries') return '/product-industries/new';
  if (endpoint === '/machine-components') return '/machine-components/new';
  if (endpoint === '/component-accessories') return '/component-accessories/new';
  return '';
}

function adminCrudFormEditHref(endpoint: string | undefined, row: TableRow) {
  if (endpoint === '/customers') {
    const customerId = readPath(row, 'id');
    return customerId ? `/customers/${String(customerId)}/edit` : '';
  }

  if (['/product-industries', '/machine-components', '/component-accessories'].includes(endpoint || '')) {
    const id = readPath(row, 'id');
    return id ? `${endpoint}/${String(id)}/edit` : '';
  }

  const serviceUpdate = serviceUpdateHref(endpoint, row);
  if (serviceUpdate) return serviceUpdate;

  return '';
}

function serviceUpdateHref(endpoint: string | undefined, row: TableRow) {
  const id = readPath(row, 'id');
  if (!id) return '';

  if (endpoint === '/repairs') return `/repairs/${String(id)}/update?returnTo=/service-tickets`;
  if (endpoint === '/maintenance') return `/maintenance/${String(id)}/update?returnTo=/service-tickets`;
  if (endpoint === '/installations') return `/installations/${String(id)}/update?returnTo=/installations`;
  return '';
}

function visibleFields(
  fields: CrudField[],
  isEditing: boolean,
  form?: FormState,
  options?: OptionMap,
  endpoint?: string,
  row?: TableRow | null,
) {
  return fields.filter((field) => {
    if (field.detailOnly) return false;
    if (isEditing && field.createOnly) return false;
    if (!isEditing && field.updateOnly) return false;
    return true;
  });
}

function machineAccessoryMode(form: FormState, options: OptionMap, row: TableRow | null): 'probe' | 'endoscopy' | 'generic' {
  const selectedModelId = form.machineModelId || String(readPath(row ?? {}, 'machineModel.id') ?? '');
  const selectedOption = options.machineModelId?.find((option) => option.value === selectedModelId);
  const rowModel = readPath(row ?? {}, 'machineModel');
  const model = selectedOption?.row ?? (rowModel && typeof rowModel === 'object' ? rowModel as Record<string, unknown> : null);

  if (isEndoscopyMachineModel(model)) return 'endoscopy';
  if (isUltrasoundMachineModel(model)) return 'probe';

  return 'generic';
}

function withQueryParams(endpoint: string, params: Record<string, string>) {
  const [path, existingQuery = ''] = endpoint.split('?');
  const searchParams = new URLSearchParams(existingQuery);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}
