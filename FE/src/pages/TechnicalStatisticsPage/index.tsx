import { ArrowLeft, Download, Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { exportReportXlsx } from '../../utils/xlsxExport';

type TechnicalStatisticsPageProps = { currentRole: RoleName; user: ApiUser };
type WorkKind = 'installation' | 'repair' | 'maintenance' | 'demo' | 'deviceService' | 'applicationSupport';
type WorkRow = {
  id: string;
  code: string;
  kind: WorkKind;
  title: string;
  status: string;
  date: string;
  engineer: string;
  customerId: string | null;
  customer: string;
  province: string;
  machineId: string | null;
  machineModelId: string | null;
  model: string;
  machineCode: string;
  serialNumber: string;
  note?: string | null;
};
type ActivityGroup = {
  id: string;
  label: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  customers: number;
  machines: number;
  lastWorkedAt: string | null;
};
type MachineGroup = {
  id: string;
  machineCode: string;
  serialNumber: string;
  model: string;
  customer: string;
  customerId: string | null;
  province: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  lastWorkedAt: string | null;
};
type TechnicalReport = {
  filters: { from: string; to: string; engineers?: Array<{ id: string; fullName?: string | null; email: string; region?: { name: string } | null }> };
  summary: { total: number; installations: number; repairs: number; maintenances: number; customers: number; machines: number };
  byModel: ActivityGroup[];
  byMachine: MachineGroup[];
  rows: WorkRow[];
};
type ModelReport = {
  model: { id: string; name: string; code?: string | null; manufacturer?: string | null; businessLine?: string | null; productIndustry?: string | null };
  summary: { installations: number; repairs: number; maintenances: number; customers: number; machines: number };
  machines: Array<{ id: string; label: string; serialNumber: string; model: string; customerId: string | null; customer: string; province: string; installations: number; repairs: number; maintenances: number; lastWorkedAt: string | null }>;
  workRows: WorkRow[];
};

const today = new Date();
const defaultFrom = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
const defaultTo = toDateInput(today);

export function TechnicalStatisticsPage({ currentRole, user }: TechnicalStatisticsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = currentRole === 'admin';
  const [from, setFrom] = useState(searchParams.get('from') || defaultFrom);
  const [to, setTo] = useState(searchParams.get('to') || defaultTo);
  const [engineerId, setEngineerId] = useState(searchParams.get('engineerId') || (isAdmin ? '' : user.id));
  const [view, setView] = useState<'models' | 'machines'>(searchParams.get('view') === 'machines' ? 'machines' : 'models');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const selectedModelId = searchParams.get('modelId') || '';
  const reportParams = new URLSearchParams({ from, to });
  if (engineerId) reportParams.set('engineerId', engineerId);

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: ['technical-statistics', 'engineers'],
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&status=ACTIVE');
      return (result.data ?? []).filter((engineer) => engineer.role?.name === 'engineer' || engineer.engineerProfile);
    },
  });
  const reportQuery = useQuery({
    queryKey: ['technical-analysis', reportParams.toString()],
    queryFn: () => apiFetch<TechnicalReport>(`/reports/technical?${reportParams.toString()}`),
  });
  const modelQuery = useQuery({
    enabled: Boolean(selectedModelId),
    queryKey: ['technical-analysis', 'model', selectedModelId, from, to],
    queryFn: () => apiFetch<ModelReport>(`/reports/models/${encodeURIComponent(selectedModelId)}?from=${from}&to=${to}`),
  });

  const report = reportQuery.data;
  const selectedModel = modelQuery.data;
  const loading = reportQuery.isLoading || reportQuery.isFetching || modelQuery.isFetching || engineersQuery.isFetching;
  const error = [reportQuery.error, modelQuery.error, engineersQuery.error].find((item) => item instanceof Error) as Error | undefined;
  const modelRows = useMemo(() => filterRows(report?.byModel ?? [], search, (row) => row.label), [report, search]);
  const machineRows = useMemo(() => filterRows(report?.byMachine ?? [], search, (row) => [row.machineCode, row.serialNumber, row.model, row.customer].join(' ')), [report, search]);
  const visibleRows = view === 'models' ? modelRows : machineRows;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pagedRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedMachine = selectedModelId ? null : searchParams.get('machineKey') || '';
  const machine = selectedMachine ? report?.byMachine.find((row) => row.id === selectedMachine) ?? null : null;
  const selectedMachineWorks = machine ? (report?.rows ?? []).filter((row) => machineKey(row) === machine.id).sort((first, second) => second.date.localeCompare(first.date)) : [];

  function updateParams(next: { from?: string; to?: string; engineerId?: string; view?: 'models' | 'machines'; modelId?: string; machineKey?: string }) {
    const params = new URLSearchParams();
    params.set('from', next.from ?? from);
    params.set('to', next.to ?? to);
    const nextEngineerId = next.engineerId ?? engineerId;
    if (nextEngineerId) params.set('engineerId', nextEngineerId);
    params.set('view', next.view ?? view);
    const nextModelId = next.modelId === undefined ? selectedModelId : next.modelId;
    if (nextModelId) params.set('modelId', nextModelId);
    const nextMachineKey = next.machineKey === undefined ? searchParams.get('machineKey') || '' : next.machineKey;
    if (nextMachineKey) params.set('machineKey', nextMachineKey);
    setSearchParams(params, { replace: true });
    if (next.from !== undefined) setFrom(next.from);
    if (next.to !== undefined) setTo(next.to);
    if (next.engineerId !== undefined) setEngineerId(next.engineerId);
    if (next.view !== undefined) setView(next.view);
    setPage(1);
  }

  function exportCurrent() {
    if (!report) return;
    if (selectedModel) {
      exportReportXlsx({
        columns: ['Ngày ghi nhận', 'Loại việc', 'Mã phiếu', 'Khách hàng', 'Máy', 'Kỹ sư', 'Nội dung'],
        filename: `model-${safeFilename(selectedModel.model.code || selectedModel.model.name)}-${from}-${to}.xlsx`,
        rows: selectedModel.workRows.map((row) => [formatDate(row.date), workLabel(row.kind), row.code, row.customer, [row.machineCode, row.serialNumber].filter(Boolean).join(' · '), row.engineer, row.note || row.title]),
        sheetName: 'Chi tiet model',
        subtitle: `${formatDate(from)} – ${formatDate(to)}`,
        title: `PHÂN TÍCH MODEL ${selectedModel.model.name}`,
      });
      return;
    }
    exportReportXlsx({
      columns: view === 'models' ? ['Model', 'Khách hàng', 'Máy', 'Lượt lắp', 'Phiếu sửa chữa', 'Lịch bảo trì', 'Hoạt động gần nhất'] : ['Mã máy', 'S/N', 'Model', 'Khách hàng', 'Tỉnh', 'Lượt lắp', 'Phiếu sửa chữa', 'Lịch bảo trì', 'Hoạt động gần nhất'],
      filename: `phan-tich-ky-thuat-${from}-${to}.xlsx`,
      rows: visibleRows.map((row) => view === 'models'
        ? [(row as ActivityGroup).label, (row as ActivityGroup).customers, (row as ActivityGroup).machines, (row as ActivityGroup).installation, (row as ActivityGroup).repair, (row as ActivityGroup).maintenance, formatDate((row as ActivityGroup).lastWorkedAt)]
        : [(row as MachineGroup).machineCode, (row as MachineGroup).serialNumber, (row as MachineGroup).model, (row as MachineGroup).customer, (row as MachineGroup).province, (row as MachineGroup).installation, (row as MachineGroup).repair, (row as MachineGroup).maintenance, formatDate((row as MachineGroup).lastWorkedAt)]),
      sheetName: view === 'models' ? 'Theo model' : 'Theo may',
      subtitle: `${formatDate(from)} – ${formatDate(to)}`,
      title: 'PHÂN TÍCH KỸ THUẬT',
    });
  }

  return (
    <PageFrame>
      <PageTitle eyebrow="Tài sản & vòng đời" title="Phân tích kỹ thuật" description="Tra cứu model và máy: đã lắp ở đâu, phát sinh bao nhiêu phiếu sửa chữa/bảo trì trong kỳ và lần hoạt động gần nhất." />

      <section className="grid gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-4 md:grid-cols-4">
        <DateInput className="grid gap-1.5 text-sm font-semibold text-[#333333]" label="Từ ngày" onChange={(value) => updateParams({ from: value, modelId: '', machineKey: '' })} value={from} />
        <DateInput className="grid gap-1.5 text-sm font-semibold text-[#333333]" label="Đến ngày" onChange={(value) => updateParams({ to: value, modelId: '', machineKey: '' })} value={to} />
        {isAdmin ? (
          <label className="grid gap-1.5 text-sm font-semibold text-[#333333]">Kỹ sư
            <select className={fieldClass} onChange={(event) => updateParams({ engineerId: event.target.value, modelId: '', machineKey: '' })} value={engineerId}>
              <option value="">Tất cả kỹ sư</option>
              {(engineersQuery.data ?? []).map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.fullName || engineer.email}</option>)}
            </select>
          </label>
        ) : <div className="grid content-end gap-1.5 text-sm"><span className="font-semibold text-[#666666]">Kỹ sư</span><strong className="flex min-h-11 items-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3">{user.fullName || user.email}</strong></div>}
        <div className="flex items-end gap-2">
          <button className="secondary-button" disabled={!report} onClick={exportCurrent} type="button"><Download size={16} />Xuất Excel</button>
          {selectedModelId || selectedMachine ? <button className="secondary-button" onClick={() => updateParams({ modelId: '', machineKey: '' })} type="button"><ArrowLeft size={16} />Quay lại phân tích</button> : null}
        </div>
      </section>

      {error ? <Notice message={error.message} /> : null}
      {loading && !report ? <section className="grid min-h-64 place-items-center rounded-2xl border border-[#e5e5e5] bg-white"><Loader2 className="spin-icon" size={22} />Đang tải dữ liệu kỹ thuật</section> : null}

      {report && !selectedModelId && !selectedMachine ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Lượt lắp đặt" value={report.summary.installations} />
            <Metric label="Phiếu sửa chữa" value={report.summary.repairs} />
            <Metric label="Lịch bảo trì" value={report.summary.maintenances} />
            <Metric label="Máy phát sinh hoạt động" value={report.summary.machines} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] px-4 py-3">
              <div><h2 className="font-semibold text-[#1f1f1f]">{view === 'models' ? 'Hoạt động theo model' : 'Hoạt động theo máy'}</h2><span className="mt-1 inline-flex rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs font-semibold text-[#666666]">{visibleRows.length}</span></div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" size={16} /><input className={`${fieldClass} pl-9`} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={view === 'models' ? 'Tìm model, mã…' : 'Tìm máy, S/N, khách…'} value={search} /></div>
                <div className="flex rounded-xl border border-[#e5e5e5] p-1">
                  <button className={view === 'models' ? activeTabClass : tabClass} onClick={() => updateParams({ view: 'models', machineKey: '' })} type="button">Theo model</button>
                  <button className={view === 'machines' ? activeTabClass : tabClass} onClick={() => updateParams({ view: 'machines', machineKey: '' })} type="button">Theo máy</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {view === 'models' ? (
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Model', 'Khách hàng', 'Máy', 'Lượt lắp', 'Phiếu sửa chữa', 'Lịch bảo trì', 'Hoạt động gần nhất'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {pagedRows.map((item) => { const row = item as ActivityGroup; return <tr className="border-b border-[#f1f1f1] last:border-0 hover:bg-[#fafafa]" key={row.id}><td className="px-4 py-3"><button className="font-semibold text-[#991b2b] hover:underline" onClick={() => updateParams({ modelId: row.id, machineKey: '' })} type="button">{row.label}</button></td><td className="px-4 py-3 tabular-nums">{row.customers}</td><td className="px-4 py-3 tabular-nums">{row.machines}</td><td className="px-4 py-3 tabular-nums">{row.installation}</td><td className="px-4 py-3 tabular-nums">{row.repair}</td><td className="px-4 py-3 tabular-nums">{row.maintenance}</td><td className="px-4 py-3">{formatDate(row.lastWorkedAt)}</td></tr>; })}
                    {!loading && !modelRows.length ? <EmptyRow colSpan={7} /> : null}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Mã máy', 'Số sê-ri', 'Model', 'Khách hàng', 'Tỉnh', 'Lắp', 'Sửa', 'Bảo trì', 'Hoạt động gần nhất'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {pagedRows.map((item) => { const row = item as MachineGroup; return <tr className="border-b border-[#f1f1f1] last:border-0 hover:bg-[#fafafa]" key={row.id}><td className="px-4 py-3"><button className="font-semibold text-[#991b2b] hover:underline" onClick={() => updateParams({ machineKey: row.id, modelId: '' })} type="button">{row.machineCode}</button></td><td className="px-4 py-3">{row.serialNumber}</td><td className="px-4 py-3">{row.model}</td><td className="px-4 py-3">{row.customerId ? <Link className="hover:text-[#991b2b]" to={`/customers/${row.customerId}`}>{row.customer}</Link> : row.customer}</td><td className="px-4 py-3">{row.province}</td><td className="px-4 py-3 tabular-nums">{row.installation}</td><td className="px-4 py-3 tabular-nums">{row.repair}</td><td className="px-4 py-3 tabular-nums">{row.maintenance}</td><td className="px-4 py-3">{formatDate(row.lastWorkedAt)}</td></tr>; })}
                    {!loading && !machineRows.length ? <EmptyRow colSpan={9} /> : null}
                  </tbody>
                </table>
              )}
            </div>
            <Pager count={visibleRows.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} />
          </section>
        </>
      ) : null}

      {selectedModelId ? (
        <ModelDetail model={selectedModel} loading={modelQuery.isFetching} error={modelQuery.error instanceof Error ? modelQuery.error.message : ''} onOpenMachine={(key) => updateParams({ machineKey: key, modelId: '' })} />
      ) : null}

      {machine ? (
        <MachineDetail machine={machine} rows={selectedMachineWorks} />
      ) : selectedMachine && report ? (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#666666]">Không tìm thấy máy trong kỳ đã chọn.</section>
      ) : null}
    </PageFrame>
  );
}

function ModelDetail({ model, loading, error, onOpenMachine }: { model?: ModelReport; loading: boolean; error: string; onOpenMachine: (key: string) => void }) {
  if (loading && !model) return <section className="grid min-h-56 place-items-center rounded-2xl border border-[#e5e5e5] bg-white"><Loader2 className="spin-icon" size={20} />Đang tải model</section>;
  if (error) return <Notice message={error} />;
  if (!model) return null;
  return <div className="grid gap-4">
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5"><span className="text-xs font-bold uppercase text-[#666666]">Model</span><h2 className="mt-1 text-xl font-bold text-[#1f1f1f]">{model.model.name}</h2><p className="mt-1 text-sm text-[#666666]">{[model.model.code, model.model.manufacturer, model.model.businessLine, model.model.productIndustry].filter(Boolean).join(' · ')}</p><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Lượt lắp đặt" value={model.summary.installations} /><Metric label="Phiếu sửa chữa" value={model.summary.repairs} /><Metric label="Lịch bảo trì" value={model.summary.maintenances} /><Metric label="Khách hàng" value={model.summary.customers} /><Metric label="Máy" value={model.summary.machines} /></div></section>
    <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white"><div className="border-b border-[#eeeeee] px-4 py-3"><h3 className="font-semibold">Máy thuộc model này</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] border-collapse text-left text-sm"><thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Máy', 'Số sê-ri', 'Khách hàng', 'Tỉnh', 'Lắp', 'Sửa', 'Bảo trì', 'Gần nhất'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{model.machines.map((row) => <tr className="border-b border-[#f1f1f1] last:border-0" key={row.id}><td className="px-4 py-3"><MachineLink id={row.id} label={row.label} /></td><td className="px-4 py-3">{row.serialNumber}</td><td className="px-4 py-3">{row.customerId ? <Link to={`/customers/${row.customerId}`}>{row.customer}</Link> : row.customer}</td><td className="px-4 py-3">{row.province}</td><td className="px-4 py-3">{row.installations}</td><td className="px-4 py-3">{row.repairs}</td><td className="px-4 py-3">{row.maintenances}</td><td className="px-4 py-3">{formatDate(row.lastWorkedAt)}</td></tr>)}{!model.machines.length ? <EmptyRow colSpan={8} /> : null}</tbody></table></div></section>
    <WorkTable title="Lịch sử công việc trong kỳ" rows={model.workRows} />
  </div>;
}

function MachineDetail({ machine, rows }: { machine: MachineGroup; rows: WorkRow[] }) {
  const machineId = machine.id.startsWith('m:') ? machine.id.slice(2) : '';
  return <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] px-4 py-3"><div><span className="text-xs font-bold uppercase text-[#666666]">Lịch sử máy trong kỳ</span><h2 className="mt-1 font-semibold">{machine.machineCode} · {machine.serialNumber}</h2><p className="mt-1 text-sm text-[#666666]">{[machine.model, machine.customer, machine.province].filter(Boolean).join(' · ')}</p></div>{machineId ? <Link className="secondary-button compact" to={`/technical-machines/${machineId}`}>Mở hồ sơ máy</Link> : null}</div><div className="grid gap-3 p-4 sm:grid-cols-3"><Metric label="Lượt lắp đặt" value={machine.installation} /><Metric label="Phiếu sửa chữa" value={machine.repair} /><Metric label="Lịch bảo trì" value={machine.maintenance} /></div><WorkTable title="Các phiếu liên quan" rows={rows} /></section>;
}

function WorkTable({ title, rows }: { title: string; rows: WorkRow[] }) {
  return <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white"><div className="border-b border-[#eeeeee] px-4 py-3"><h3 className="font-semibold">{title}</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-sm"><thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Ngày', 'Loại hồ sơ', 'Mã phiếu', 'Khách hàng', 'Máy', 'Kỹ sư', 'Trạng thái'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-b border-[#f1f1f1] last:border-0" key={`${row.kind}-${row.id}`}><td className="px-4 py-3">{formatDate(row.date)}</td><td className="px-4 py-3">{workLabel(row.kind)}</td><td className="px-4 py-3 font-semibold">{row.code}</td><td className="px-4 py-3">{row.customerId ? <Link to={`/customers/${row.customerId}`}>{row.customer}</Link> : row.customer}</td><td className="px-4 py-3">{[row.machineCode, row.serialNumber].filter(Boolean).join(' · ')}</td><td className="px-4 py-3">{row.engineer}</td><td className="px-4 py-3">{row.status}</td></tr>)}{!rows.length ? <EmptyRow colSpan={7} /> : null}</tbody></table></div></section>;
}

function MachineLink({ id, label }: { id: string; label: string }) {
  const machineId = id.startsWith('m:') ? id.slice(2) : '';
  return machineId ? <Link className="font-semibold text-[#991b2b] hover:underline" to={`/technical-machines/${machineId}`}>{label}</Link> : <strong>{label}</strong>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#fafafa] p-3"><span className="text-xs font-semibold text-[#666666]">{label}</span><strong className="mt-1 block text-2xl tabular-nums text-[#1f1f1f]">{value}</strong></div>; }
function Pager({ count, page, pageSize, totalPages, onPageChange }: { count: number; page: number; pageSize: number; totalPages: number; onPageChange: (value: number) => void }) { const first = count ? (page - 1) * pageSize + 1 : 0; const last = Math.min(count, page * pageSize); return <div className="flex items-center justify-between border-t border-[#eeeeee] px-4 py-3 text-sm text-[#666666]"><span>{count ? `${first}–${last} / ${count}` : '0 kết quả'}</span><div className="flex items-center gap-2"><button className="secondary-button compact" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">Trước</button><span>{page}/{totalPages}</span><button className="secondary-button compact" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} type="button">Sau</button></div></div>; }
function EmptyRow({ colSpan }: { colSpan: number }) { return <tr><td className="px-4 py-8 text-center text-sm text-[#666666]" colSpan={colSpan}>Không có dữ liệu trong khoảng thời gian đã chọn.</td></tr>; }
function filterRows<T>(rows: T[], value: string, getText: (row: T) => string) { const query = value.trim().toLocaleLowerCase('vi'); return query ? rows.filter((row) => getText(row).toLocaleLowerCase('vi').includes(query)) : rows; }
function machineKey(row: WorkRow) { if (row.machineId) return `m:${row.machineId}`; if (row.serialNumber && row.serialNumber !== '-') return `s:${row.serialNumber}`; if (row.machineCode && row.machineCode !== '-') return `c:${row.machineCode}`; return null; }
function workLabel(kind: WorkKind) { if (kind === 'installation') return 'Lắp đặt'; if (kind === 'repair') return 'Sửa chữa'; if (kind === 'maintenance') return 'Bảo trì'; if (kind === 'demo') return 'Demo'; if (kind === 'deviceService') return 'Nhận/trả thiết bị'; return 'Hỗ trợ ứng dụng'; }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date); }
function toDateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function safeFilename(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'model'; }

const fieldClass = 'min-h-11 rounded-xl border border-[#ded8d8] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]';
const tabClass = 'rounded-lg px-3 py-2 text-sm font-semibold text-[#666666] hover:bg-[#f6f6f6]';
const activeTabClass = 'rounded-lg bg-[#18181b] px-3 py-2 text-sm font-semibold text-white';
