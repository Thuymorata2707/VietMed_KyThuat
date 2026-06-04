import { Edit3, ImageOff, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { FormEvent, KeyboardEvent, MouseEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { AdminCrudConfig, CrudField } from '../../config/adminCrud';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { TableRow, filterRows, formatValue, readPath } from '../../utils/format';
import './styles.css';

type SelectOption = { label: string; value: string };
type OptionMap = Record<string, SelectOption[]>;
type FormState = Record<string, string>;
type PaginationState = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

const pageSizeOptions = [10, 20, 50, 100];

export function AdminCrudPage({ config }: { config: AdminCrudConfig }) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [options, setOptions] = useState<OptionMap>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
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
  }, [config.endpoint, debouncedQuery, page, pageSize]);

  useEffect(() => {
    setPage(1);
    setSelectedRow(null);
  }, [config.endpoint]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredRows = useMemo(() => (pagination ? rows : filterRows(rows, query)), [pagination, query, rows]);

  useEffect(() => {
    if (!pagination) return;
    setPage((current) => Math.min(current, Math.max(1, pagination.totalPages)));
  }, [pagination]);

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const [rowsResult, optionsResult] = await Promise.all([
        loadRows(config.endpoint, page, pageSize, debouncedQuery),
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
    setForm(buildInitialForm(visibleFields(config.fields, false), null, options));
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
    setForm(buildInitialForm(visibleFields(config.fields, true), row, options));
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
      const payload = buildPayload(visibleFields(config.fields, Boolean(editingRow)), form);
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

  return (
    <PageFrame>
      <div className="admin-crud-heading">
        <PageTitle eyebrow="Admin" title={config.title} description={config.description} />
        <button className="secondary-button" disabled={loading} onClick={loadPage} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="admin-crud-list">
        <div className="list-toolbar">
          <input onChange={(event) => handleSearchChange(event.target.value)} placeholder={config.searchPlaceholder} value={query} />
          <button className="primary-button compact" onClick={startCreate} type="button">
            <Plus size={17} />
            Tạo mới
          </button>
        </div>

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
                          <button
                            className="icon-button"
                            onClick={(event) => handleActionClick(event, () => startEdit(row))}
                            title="Sửa"
                            type="button"
                          >
                            <Edit3 size={16} />
                          </button>
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
                  <td colSpan={config.columns.length + (config.canUpdate !== false || config.canDelete !== false ? 1 : 0)}>
                    <div className="table-state">
                      <Loader2 className="spin-icon" size={18} />
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + (config.canUpdate !== false || config.canDelete !== false ? 1 : 0)}>
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

      {selectedRow ? (
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
                <button className="primary-button" onClick={() => startEdit(selectedRow)} type="button">
                  <Edit3 size={17} />
                  Sửa thông tin
                </button>
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
          <section aria-modal="true" className="crud-modal" role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>{editingRow ? 'Cập nhật' : 'Tạo mới'}</span>
                <h2>{editingRow ? String(readPath(editingRow, config.columns[0]?.key || 'id')) : config.title}</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="admin-crud-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                {visibleFields(config.fields, Boolean(editingRow)).map((field) => (
                  <FieldControl
                    field={field}
                    key={field.name}
                    onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
                    options={options[field.name] || field.options || []}
                    value={form[field.name] ?? ''}
                  />
                ))}
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : editingRow ? 'Lưu thay đổi' : 'Tạo mới'}
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
              <span className="confirm-eyebrow">Xác nhận xóa</span>
              <h2>{formatValue(readPath(deletingRow, config.columns[0]?.key || 'id'))}</h2>
              <p>Thao tác này sẽ xóa {config.entityLabel} khỏi hệ thống nếu backend cho phép.</p>
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

function FieldControl({
  field,
  value,
  options,
  onChange,
}: {
  field: CrudField;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  if (field.type === 'textarea' || field.type === 'tags') {
    return (
      <label className="wide-field">
        {field.label}
        <textarea
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.type === 'tags' ? 'Mỗi dòng là một mục' : undefined}
          required={field.required}
          value={value}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label>
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
    <label>
      {field.label}
      <input onChange={(event) => onChange(event.target.value)} required={field.required} type={inputType(field)} value={value} />
      {field.type === 'image' && value ? (
        <span className="image-field-preview">
          <img alt="" src={value} />
        </span>
      ) : null}
    </label>
  );
}

function buildDetailItems(config: AdminCrudConfig, row: TableRow, options: OptionMap) {
  const items: Array<{ label: string; value: ReactNode }> = [];
  const usedLabels = new Set<string>();

  config.columns.forEach((column) => {
    const value = renderDetailValue(readPath(row, column.key), column.key);
    items.push({ label: column.label, value });
    usedLabels.add(column.label);
  });

  config.fields.forEach((field) => {
    if (usedLabels.has(field.label)) return;
    items.push({ label: field.label, value: formatFieldDetailValue(field, row, options) });
    usedLabels.add(field.label);
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
    return matchedOption?.label || formatValue(rawValue);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.length ? rawValue.map((item) => formatValue(item)).join(', ') : '-';
  }

  return formatValue(rawValue);
}

function renderTableValue(value: unknown, key: string) {
  if (!isImageKey(key)) return formatValue(value);
  if (!value || typeof value !== 'string') return '-';

  return (
    <ImagePreview className="table-image" src={value} />
  );
}

function renderDetailValue(value: unknown, key: string) {
  if (!isImageKey(key)) return formatValue(value);
  if (!value || typeof value !== 'string') return '-';

  return (
    <span className="detail-image">
      <ImagePreview className="detail-image-frame" src={value} />
      <span>{value}</span>
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

function inputType(field: CrudField) {
  if (field.type === 'image') return 'url';
  return field.type || 'text';
}

async function loadRows(endpoint: string, page: number, limit: number, search: string) {
  const endpointWithQuery = withQueryParams(endpoint, {
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
      .filter((field) => field.optionSource)
      .map(async (field) => {
        const source = field.optionSource!;
        const result = await apiFetch<Paginated<TableRow> | TableRow[]>(source.endpoint);
        const rows = Array.isArray(result) ? result : result.data;
        return [
          field.name,
          rows.map((row) => ({
            label: String(readPath(row, source.labelPath) ?? ''),
            value: String(readPath(row, source.valuePath) ?? ''),
          })),
        ] as const;
      }),
  );

  return Object.fromEntries(entries);
}

function buildInitialForm(fields: CrudField[], row: TableRow | null, options: OptionMap) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!row) {
        return [field.name, field.required ? (options[field.name]?.[0]?.value || field.options?.[0]?.value || '') : ''];
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
  const payload: Record<string, string | string[]> = {};

  fields.forEach((field) => {
    const value = form[field.name]?.trim() ?? '';
    if (!value && !field.required) return;
    payload[field.name] = field.type === 'tags' ? value.split('\n').map((item) => item.trim()).filter(Boolean) : value;
  });

  return payload;
}

function visibleFields(fields: CrudField[], isEditing: boolean) {
  return fields.filter((field) => {
    if (isEditing && field.createOnly) return false;
    if (!isEditing && field.updateOnly) return false;
    return true;
  });
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
