import { Edit3, Search } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { ResourceConfig } from '../../config/resources';
import { TableRow, filterRows, formatValue, readPath } from '../../utils/format';

export function ResourcePage({
  config,
  toolbarControl,
  getEditHref,
}: {
  config: ResourceConfig;
  toolbarControl?: ReactNode;
  getEditHref?: (row: TableRow) => string | null;
}) {
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

      <div className="flex min-w-0 items-center justify-between gap-3.5 max-sm:flex-col max-sm:items-stretch">
        <div className="flex min-h-11 max-w-[520px] flex-1 items-center gap-2.5 rounded-lg border border-[#dde5ee] bg-white px-3 text-[#667085] transition focus-within:-translate-y-px focus-within:border-[#d92d20] focus-within:shadow-[0_0_0_3px_rgba(217,45,32,0.12)] max-sm:max-w-none">
          <Search size={18} />
          <input
            className="min-w-0 flex-1 border-0 text-[#101828] outline-none"
            disabled={config.searchEnabled === false}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={config.searchPlaceholder}
            value={query}
          />
        </div>
        {toolbarControl}
        <div className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-full border border-[#dde5ee] bg-white px-3 text-[13px] font-medium text-[#667085]">
          {loading ? 'Đang tải' : `${meta?.total ?? rows.length} bản ghi`}
        </div>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="overflow-x-auto rounded-lg border border-[#dde5ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(16,24,40,0.06)]">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th className="sticky top-0 z-[1] border-b border-[#edf2f7] bg-[#f8fbfd] px-4 py-3.5 text-left text-xs font-medium text-[#667085]" key={column.key}>{column.label}</th>
              ))}
              {getEditHref ? <th className="sticky top-0 z-[1] border-b border-[#edf2f7] bg-[#f8fbfd] px-4 py-3.5 text-right text-xs font-medium text-[#667085]"></th> : null}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.map((row, index) => {
              const editHref = getEditHref?.(row) ?? null;
              return (
              <tr className="even:bg-[#fcfdff] hover:bg-[#fbfdff]" key={String(row.id ?? index)}>
                {config.columns.map((column) => (
                  <td className="border-b border-[#edf2f7] px-4 py-3.5 text-left text-[#202939]" key={column.key}>{formatValue(readColumnValue(row, column))}</td>
                ))}
                {getEditHref ? (
                  <td className="border-b border-[#edf2f7] px-4 py-3.5 text-right">
                    {editHref ? (
                      <Link className="icon-button" title="Sửa" to={editHref}>
                        <Edit3 size={16} />
                      </Link>
                    ) : null}
                  </td>
                ) : null}
              </tr>
              );
            })}
            {loading
              ? Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr className="skeleton-row" key={`loading-${rowIndex}`}>
                    {config.columns.map((column, columnIndex) => (
                      <td className="border-b border-[#edf2f7] px-4 py-3.5 text-left text-[#202939]" key={column.key}>
                        <span
                          className="skeleton-line"
                          style={{ width: `${columnIndex % 2 === 0 ? 74 : 52}%` }}
                        />
                      </td>
                    ))}
                    {getEditHref ? <td className="border-b border-[#edf2f7] px-4 py-3.5" /> : null}
                  </tr>
                ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + (getEditHref ? 1 : 0)}>
                  <div className="grid min-h-[180px] place-items-center content-center justify-center gap-2.5 text-center text-[#667085] [&_svg]:h-[42px] [&_svg]:w-[42px] [&_svg]:rounded-lg [&_svg]:border [&_svg]:border-[#fecdca] [&_svg]:bg-[#fff4f2] [&_svg]:p-2.5 [&_svg]:text-[#d92d20]">
                    {config.icon}
                    <strong className="text-[15px] text-[#101828]">Chưa có dữ liệu phù hợp</strong>
                    <span className="text-[13px]">Thử đổi từ khóa tìm kiếm hoặc kiểm tra bộ lọc hiện tại.</span>
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

function readColumnValue(row: TableRow, column: ResourceConfig['columns'][number]) {
  const value = readPath(row, column.key);
  if (value !== null && value !== undefined && value !== '') return value;

  for (const fallbackKey of column.fallbackKeys ?? []) {
    const fallbackValue = readPath(row, fallbackKey);
    if (fallbackValue !== null && fallbackValue !== undefined && fallbackValue !== '') return fallbackValue;
  }

  return value;
}
