import { Edit3, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { ResourceConfig } from '../../config/resources';
import { queryKeys } from '../../lib/queryKeys';
import { TableRow, filterRows, formatValue, readPath } from '../../utils/format';

export function ResourcePage({
  config,
  extraQueryParams,
  getEditHref,
  toolbarControl,
}: {
  config: ResourceConfig;
  extraQueryParams?: Record<string, string>;
  toolbarControl?: ReactNode;
  getEditHref?: (row: TableRow) => string | null;
}) {
  const [query, setQuery] = useState('');
  const resourceParams = useMemo(() => {
    const search = new URLSearchParams({ ...extraQueryParams, page: '1', limit: '10' });
    if (config.searchEnabled !== false && query.trim()) search.set('search', query.trim());
    return search.toString();
  }, [config.searchEnabled, extraQueryParams, query]);

  const resourceQuery = useQuery({
    queryKey: queryKeys.resources.list(config.endpoint, resourceParams),
    queryFn: async () => {
      const result = await apiFetch<Paginated<TableRow> | TableRow[]>(`${config.endpoint}?${resourceParams}`);
      if (Array.isArray(result)) {
        const filteredRows = filterRows(result, query);
        return {
          rows: filteredRows,
          meta: {
            page: 1,
            limit: result.length,
            total: filteredRows.length,
            totalPages: 1,
          },
        };
      }

      return {
        rows: result.data ?? [],
        meta: result.meta ?? null,
      };
    },
  });

  const rows = resourceQuery.data?.rows ?? [];
  const meta = resourceQuery.data?.meta ?? null;
  const loading = resourceQuery.isLoading || resourceQuery.isFetching;
  const error = resourceQuery.error instanceof Error ? resourceQuery.error.message : '';

  return (
    <PageFrame>
      <PageTitle eyebrow="Danh mục vận hành" title={config.title} description={config.description} />

      <div className="flex min-w-0 items-center justify-between gap-3.5 max-sm:flex-col max-sm:items-stretch">
        <div className="flex min-h-11 max-w-[520px] flex-1 items-center gap-2.5 rounded-lg border border-[#e5e5e5] bg-white px-3 text-[#666666] transition focus-within:-translate-y-px focus-within:border-[#0f766e] focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.12)] max-sm:max-w-none">
          <Search size={18} />
          <input
            className="min-w-0 flex-1 border-0 text-[#1f1f1f] outline-none"
            disabled={config.searchEnabled === false}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={config.searchPlaceholder}
            value={query}
          />
        </div>
        {toolbarControl}
        <div className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-full border border-[#e5e5e5] bg-white px-3 text-[13px] font-medium text-[#666666]">
          {loading ? 'Đang tải' : `${meta?.total ?? rows.length} bản ghi`}
        </div>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)] transition hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(20,32,51,0.06)]">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th className="sticky top-0 z-[1] border-b border-[#eeeeee] bg-[#f8fbfd] px-4 py-3.5 text-left text-xs font-medium text-[#666666]" key={column.key}>{column.label}</th>
              ))}
              {getEditHref ? <th className="sticky top-0 z-[1] border-b border-[#eeeeee] bg-[#f8fbfd] px-4 py-3.5 text-right text-xs font-medium text-[#666666]"></th> : null}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.map((row, index) => {
              const editHref = getEditHref?.(row) ?? null;
              return (
              <tr className="even:bg-[#fcfdff] hover:bg-[#fbfdff]" key={String(row.id ?? index)}>
                {config.columns.map((column) => (
                  <td className="border-b border-[#eeeeee] px-4 py-3.5 text-left text-[#202939]" key={column.key}>{formatValue(readColumnValue(row, column))}</td>
                ))}
                {getEditHref ? (
                  <td className="border-b border-[#eeeeee] px-4 py-3.5 text-right">
                    {editHref ? (
                      <Link className="icon-button" title="Edit" to={editHref}>
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
                      <td className="border-b border-[#eeeeee] px-4 py-3.5 text-left text-[#202939]" key={column.key}>
                        <span
                          className="skeleton-line"
                          style={{ width: `${columnIndex % 2 === 0 ? 74 : 52}%` }}
                        />
                      </td>
                    ))}
                    {getEditHref ? <td className="border-b border-[#eeeeee] px-4 py-3.5" /> : null}
                  </tr>
                ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + (getEditHref ? 1 : 0)}>
                  <div className="grid min-h-[180px] place-items-center content-center justify-center gap-2.5 text-center text-[#666666] [&_svg]:h-[42px] [&_svg]:w-[42px] [&_svg]:rounded-lg [&_svg]:border [&_svg]:border-[#b7e4dd] [&_svg]:bg-[#ecfdf8] [&_svg]:p-2.5 [&_svg]:text-[#0f766e]">
                    {config.icon}
                    <strong className="text-[15px] text-[#1f1f1f]">Chưa có dữ liệu phù hợp</strong>
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
