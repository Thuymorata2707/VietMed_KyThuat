import { Search } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { ResourceConfig } from '../../config/resources';
import { TableRow, filterRows, formatValue, readPath } from '../../utils/format';
import './styles.css';

export function ResourcePage({ config, toolbarControl }: { config: ResourceConfig; toolbarControl?: ReactNode }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<TableRow[]>([]);
  const [meta, setMeta] = useState<Paginated<TableRow>['meta'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const search = new URLSearchParams({ page: '1', limit: '10' });
    if (config.searchEnabled !== false && query.trim()) search.set('search', query.trim());

    setLoading(true);
    apiFetch<Paginated<TableRow> | TableRow[]>(`${config.endpoint}?${search.toString()}`)
      .then((result) => {
        if (Array.isArray(result)) {
          const filteredRows = filterRows(result, query);
          setRows(filteredRows);
          setMeta({
            page: 1,
            limit: result.length,
            total: filteredRows.length,
            totalPages: 1,
          });
          setError('');
          return;
        }

        setRows(result.data ?? []);
        setMeta(result.meta ?? null);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [config.endpoint, config.searchEnabled, query]);

  return (
    <PageFrame>
      <PageTitle eyebrow="Danh mục vận hành" title={config.title} description={config.description} />

      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            disabled={config.searchEnabled === false}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={config.searchPlaceholder}
            value={query}
          />
        </div>
        {toolbarControl}
        <div className="result-count">
          {loading ? 'Đang tải' : `${meta?.total ?? rows.length} bản ghi`}
        </div>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {config.columns.map((column) => (
                  <td key={column.key}>{formatValue(readPath(row, column.key))}</td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length}>
                  <div className="empty-state">
                    {config.icon}
                    <span>Chưa có dữ liệu phù hợp</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}
