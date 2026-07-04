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

const pageSizeOptions = [10, 20, 50, 100];
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
  const [pageSize, setPageSize] = useState(20);
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
  const isCustomerCrud = isCustomersEndpoint(config.endpoint);
  const customerStats = useMemo(() => buildCustomerStats(rows), [rows]);
  const tableColumnCount = (isCustomerCrud ? 6 : config.columns.length) + (config.canUpdate !== false || config.canDelete !== false ? 1 : 0);

  useEffect(() => {
    if (!pagination) return;
    setPage((current) => Math.min(current, Math.max(1, pagination.totalPages)));
  }, [pagination]);

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
                Add Ticket
              </Link>
            ) : adminCrudFormCreateHref(config.endpoint) ? (
              <Link className="primary-button compact" to={adminCrudFormCreateHref(config.endpoint)!}>
                <Plus size={17} />
                Add
              </Link>
            ) : (
              <button className="primary-button compact" onClick={startCreate} type="button">
                <Plus size={17} />
                Add
              </button>
            )
          ) : null}
        </div>

        {isCustomerCrud ? (
          <div className="customer-card-list">
            {filteredRows.map((row, index) => (
              <CustomerCard
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
              <div className="table-state">
                <Loader2 className="spin-icon" size={18} />
                Đang tải dữ liệu...
              </div>
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <div className="table-state empty-state">
                <strong>Không có dữ liệu phù hợp</strong>
                <span>Thử đổi từ khóa tìm kiếm hoặc tạo mới {config.entityLabel}.</span>
              </div>
            ) : null}
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
                                title="Edit"
                                to={adminCrudFormEditHref(config.endpoint, row)!}
                              >
                                <Edit3 size={16} />
                              </Link>
                            ) : (
                              <button
                                className="icon-button"
                                onClick={(event) => handleActionClick(event, () => startEdit(row))}
                                title="Edit"
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
                              title="Delete"
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
              Dòng/trang
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
              <button className="icon-button" onClick={() => setSelectedRow(null)} title="Close" type="button">
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
                    Edit
                  </Link>
                ) : (
                  <button className="primary-button" onClick={() => startEdit(selectedRow)} type="button">
                    <Edit3 size={17} />
                    Edit
                  </button>
                )
              ) : null}
              {config.canDelete !== false ? (
                <button className="danger-button" onClick={() => setDeletingRow(selectedRow)} type="button">
                  <Trash2 size={17} />
                  Delete
                </button>
              ) : null}
              <button className="secondary-button" onClick={() => setSelectedRow(null)} type="button">
                Close
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
                <span>{editingRow ? 'Edit' : 'Add'}</span>
                <h2>{editingRow ? String(readPath(editingRow, config.columns[0]?.key || 'id')) : config.title}</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Close" type="button">
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
                  Cancel
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Saving' : 'Save'}
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
              <span className="confirm-eyebrow">Delete</span>
              <h2>{formatValue(readPath(deletingRow, config.columns[0]?.key || 'id'))}</h2>
              <p>Delete this {config.entityLabel} if backend allows.</p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeletingRow(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" onClick={removeRow} type="button">
                Delete
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
      const payload = isMachinesEndpoint(config.endpoint) ? buildMachinePayload(fields, form, row) : buildPayload(fields, form);

      if (isEditing) {
        await apiFetch(`${config.endpoint}/${id}`, {
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
          title={isEditing ? `Edit ${config.entityLabel}` : `Add ${config.entityLabel}`}
          description={config.description}
        />
        <button className="secondary-button" onClick={() => navigate(listPath)} type="button">
          <ArrowLeft size={17} />
          Back
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className={isCustomerForm ? 'crud-form-page customer-form-page' : 'crud-form-page'}>
        <div className="form-panel-heading">
          <div>
            <span>{isEditing ? 'Edit' : 'Add'}</span>
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
                Cancel
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                {saving ? 'Saving' : 'Save'}
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
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
          <button className="icon-button" onClick={onClose} title="Close" type="button">
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
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button className="danger-button" onClick={onDelete} type="button">
              <Trash2 size={16} />
              Delete
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

function CustomerCard({
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
  const address = [readPath(row, 'address'), readPath(row, 'district'), readPath(row, 'province')]
    .filter(Boolean)
    .map((value) => String(value))
    .join(', ');
  const phone = formatDisplayValue(readPath(row, 'contactPhone') || readPath(row, 'phone'));
  const contact = formatDisplayValue(readPath(row, 'contactPerson'));
  const region = formatDisplayValue(readPath(row, 'region.name'));
  const engineer = formatDisplayValue(readPath(row, 'primaryEngineer.fullName'));
  const machineCount = Number(readPath(row, '_count.machines') ?? 0);

  return (
    <article
      className="customer-card"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
    >
      <div className="customer-card-main">
        <div className="customer-name-cell">
          <strong>{name}</strong>
          <span>{[code !== '-' ? code : '', displayLabel(String(readPath(row, 'customerType') ?? ''))].filter(Boolean).join(' - ') || 'Chưa phân loại'}</span>
          {address ? <small>{address}</small> : null}
        </div>

        <div className="customer-card-meta">
          <div className="customer-stack-cell">
            <span>Liên hệ</span>
            <strong>{contact}</strong>
            <small>{phone}</small>
          </div>
          <div className="customer-stack-cell">
            <span>Khu vực</span>
            <strong>{region}</strong>
          </div>
          <div className="customer-stack-cell">
            <span>Phụ trách</span>
            <strong>{engineer === '-' ? 'Chưa gán' : engineer}</strong>
          </div>
        </div>
      </div>

      <div className="customer-card-side">
        <span className="customer-machine-count">{machineCount} máy</span>
        {renderStatusBadge(readPath(row, 'status'))}
        {canUpdate || canDelete ? (
          <div className="row-actions" onClick={(event) => event.stopPropagation()}>
            <Link className="customer-profile-link" to={`/customers/profile?customerId=${String(readPath(row, 'id') ?? '')}`}>
              Hồ sơ
            </Link>
            {canUpdate ? (
              editHref ? (
                <Link className="icon-button" title="Edit" to={editHref}>
                  <Edit3 size={16} />
                </Link>
              ) : (
                <button className="icon-button" onClick={onEdit} title="Edit" type="button">
                  <Edit3 size={16} />
                </button>
              )
            ) : null}
            {canDelete ? (
              <button className="icon-button danger" onClick={onDelete} title="Delete" type="button">
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
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
      description: 'Tên khách hàng, mã nội bộ, trạng thái và người phụ trách.',
      fields: ['name', 'hospitalName', 'shortName', 'customerCode', 'customerType', 'status', 'regionId', 'primaryEngineerId'],
    },
    {
      title: 'Liên hệ',
      description: 'Thông tin để kỹ sư và admin liên lạc khi cần xử lý máy.',
      fields: ['phone', 'email', 'taxCode', 'contactPerson', 'contactPhone', 'contactEmail'],
    },
    {
      title: 'Địa chỉ',
      description: 'Dùng cho lắp đặt, bảo trì và điều phối lịch công tác.',
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
        return [field.name, field.required ? (options[field.name]?.[0]?.value || field.options?.[0]?.value || '') : ''];
      }

      if (isMachinesEndpoint(endpoint) && field.name === 'accessories') {
        return [field.name, serializeMachineAccessories(readPath(row, 'accessories'))];
      }

      const rawValue = readPath(row, field.valuePath || field.name);
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

function buildPayload(fields: CrudField[], form: FormState) {
  const payload: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = form[field.name]?.trim() ?? '';
    if (!value && !field.required) return;
    payload[field.name] = field.type === 'tags' ? value.split('\n').map((item) => item.trim()).filter(Boolean) : value;
  });

  return payload;
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
  return '';
}

function adminCrudFormEditHref(endpoint: string | undefined, row: TableRow) {
  if (endpoint === '/customers') {
    const customerId = readPath(row, 'id');
    return customerId ? `/customers/${String(customerId)}/edit` : '';
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
