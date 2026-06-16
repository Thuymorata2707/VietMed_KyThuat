import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, PackageSearch, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { displayLabel } from '../../utils/displayLabels';

type DashboardCustomer = {
  id: string;
  customerCode?: string | null;
  name: string;
  hospitalName?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  fullAddress?: string | null;
};

type DashboardEngineer = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type DashboardMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  modelName: string;
  name?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  status?: string | null;
  inventoryStatus?: string | null;
  installDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  installedBy?: DashboardEngineer | null;
  primaryEngineer?: DashboardEngineer | null;
  customer?: DashboardCustomer | null;
  accessories?: Array<{
    id: string;
    code?: string | null;
    name: string;
    serialNumber?: string | null;
    description?: string | null;
    note?: string | null;
    componentAccessory?: {
      id: string;
      code?: string | null;
      name: string;
      component?: {
        id: string;
        code?: string | null;
        name: string;
      } | null;
    } | null;
  }>;
  installation?: {
    id: string;
    code: string;
    status: string;
    installedAt: string;
    receiverInstallAddress?: string | null;
    receiverRepresentative?: string | null;
    receiverPhone?: string | null;
    warrantyCard?: {
      id: string;
      code: string;
      status: string;
      startDate: string;
      endDate: string;
    } | null;
  } | null;
};

type TechnicalMachineGroup = {
  id: string | null;
  code: string | null;
  name: string;
  productCategory: string;
  count: number;
};

type TechnicalMachines = {
  total: number;
  filteredTotal: number;
  page: number;
  limit: number;
  totalPages: number;
  businessLines: TechnicalMachineGroup[];
  machines: DashboardMachine[];
};

export function TechnicalMachinesPage() {
  const navigate = useNavigate();
  const [technicalMachines, setTechnicalMachines] = useState<TechnicalMachines | null>(null);
  const [selectedBusinessLineKey, setSelectedBusinessLineKey] = useState('ALL');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [installState, setInstallState] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadTechnicalMachines();
  }, [search, selectedBusinessLineKey, installState, page, limit]);

  async function loadTechnicalMachines() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search) params.set('search', search);
      if (selectedBusinessLineKey !== 'ALL') params.set('businessLineId', selectedBusinessLineKey);
      if (installState !== 'ALL') params.set('installState', installState);

      const result = await apiFetch<TechnicalMachines>(`/dashboard/technical-machines?${params.toString()}`);
      const firstMachine = result.machines[0];
      setTechnicalMachines(result);
      setSelectedMachineId((current) => (current && result.machines.some((machine) => machine.id === current) ? current : firstMachine?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách máy.');
    } finally {
      setLoading(false);
    }
  }

  const selectedBusinessLine = useMemo(() => {
    if (selectedBusinessLineKey === 'ALL') return null;
    if (!technicalMachines?.businessLines.length) return null;
    return technicalMachines.businessLines.find((businessLine) => businessLineKey(businessLine) === selectedBusinessLineKey) ?? null;
  }, [selectedBusinessLineKey, technicalMachines]);

  const selectedMachine = useMemo(() => {
    if (!technicalMachines?.machines.length) return null;
    return technicalMachines.machines.find((machine) => machine.id === selectedMachineId) ?? technicalMachines.machines[0];
  }, [selectedMachineId, technicalMachines]);

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setInstallState('ALL');
    setSelectedBusinessLineKey('ALL');
    setSelectedMachineId(null);
    setPage(1);
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Phòng kỹ thuật"
          title="Danh sách máy quản lý"
          description="Chọn ngành hàng, xem số S/N của máy và thông tin khách hàng đã lắp. Máy chưa lắp sẽ để trống thông tin khách hàng."
        />
        <button className="secondary-button" onClick={() => navigate('/')} type="button">
          <ArrowLeft size={17} />
          Quay lại Dashboard
        </button>
      </div>

      {error ? <Notice message={error} /> : null}

      <section className="grid min-w-0 gap-3 rounded-lg border border-[#dfe7ef] bg-white p-4 min-[1320px]:grid-cols-[minmax(220px,1fr)_180px_150px_auto]">
        <label className="relative grid min-w-0 gap-2 text-sm font-semibold text-[#405064]">
          Tìm kiếm
          <Search className="pointer-events-none absolute bottom-[11px] left-3 text-[#8a98aa]" size={17} />
          <input
            className="h-11 min-w-0 rounded-lg border border-[#ced8e3] pl-9 pr-3 text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="S/N máy, model, khách hàng, S/N đầu dò..."
            value={searchInput}
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#405064]">
          Trạng thái lắp
          <select
            className="h-11 min-w-0 rounded-lg border border-[#ced8e3] px-3 text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]"
            onChange={(event) => {
              setInstallState(event.target.value);
              setPage(1);
              setSelectedMachineId(null);
            }}
            value={installState}
          >
            <option value="ALL">Tất cả</option>
            <option value="INSTALLED">Đã lắp</option>
            <option value="UNINSTALLED">Chưa lắp</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#405064]">
          Số dòng
          <select
            className="h-11 min-w-0 rounded-lg border border-[#ced8e3] px-3 text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]"
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
              setSelectedMachineId(null);
            }}
            value={limit}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button className="secondary-button self-end" onClick={resetFilters} type="button">
          <RotateCcw size={17} />
          Đặt lại
        </button>
      </section>

      <section className="grid min-w-0 gap-4 min-[1320px]:grid-cols-[280px_minmax(0,1fr)] min-[1680px]:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <div className="rounded-lg border border-[#dfe7ef] bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#17202a]">Máy theo ngành hàng</h2>
                <p className="text-sm text-[#657384]">
                  {loading ? 'Đang tải dữ liệu máy.' : `${technicalMachines?.businessLines.length ?? 0} ngành hàng`}
                </p>
              </div>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-[#f8fafc] px-2.5 text-sm font-bold text-[#2f5f98]">
                {loading ? <Loader2 className="spin-icon" size={17} /> : <PackageSearch size={17} />}
                {loading ? '-' : technicalMachines?.total ?? 0}
              </span>
            </div>

            <div className="grid gap-2">
              <button
                className={`grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${selectedBusinessLineKey === 'ALL' ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf1f6] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                onClick={() => {
                  setSelectedBusinessLineKey('ALL');
                  setSelectedMachineId(null);
                  setPage(1);
                }}
                type="button"
              >
                <span className="grid min-w-0 gap-1">
                  <strong className="truncate text-sm text-[#17202a]">Tất cả ngành hàng</strong>
                  <span className="text-[12px] text-[#657384]">Theo bộ lọc hiện tại</span>
                </span>
                <b className="text-lg text-[#2f5f98]">{technicalMachines?.businessLines.reduce((sum, item) => sum + item.count, 0) ?? 0}</b>
              </button>
              {technicalMachines?.businessLines.length ? (
                technicalMachines.businessLines.map((businessLine) => {
                  const isActive = businessLineKey(businessLine) === selectedBusinessLineKey;
                  return (
                    <button
                      className={`grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${isActive ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf1f6] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                      key={businessLineKey(businessLine)}
                      onClick={() => {
                        setSelectedBusinessLineKey(businessLineKey(businessLine));
                        setSelectedMachineId(null);
                        setPage(1);
                      }}
                      type="button"
                    >
                      <span className="grid min-w-0 gap-1">
                        <strong className="truncate text-sm text-[#17202a]">{businessLine.name}</strong>
                        <span className="text-[12px] text-[#657384]">{businessLine.code || displayProductCategory(businessLine.productCategory)}</span>
                      </span>
                      <b className="text-lg text-[#2f5f98]">{businessLine.count}</b>
                      </button>
                  );
                })
              ) : (
                <EmptyState text={loading ? 'Đang tải dữ liệu máy.' : 'Chưa có máy trong phạm vi dữ liệu.'} />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe7ef] bg-white p-4">
            <div className="mb-4">
              <h2 className="text-base font-bold text-[#17202a]">Số S/N</h2>
              <p className="text-sm text-[#657384]">
                {selectedBusinessLine?.name ?? 'Tất cả ngành hàng'} - {technicalMachines?.filteredTotal ?? 0} kết quả
              </p>
            </div>
            <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
              {technicalMachines?.machines.length ? (
                technicalMachines.machines.map((machine) => (
                  <button
                    className={`grid min-h-[50px] gap-1 rounded-lg border px-2.5 py-2 text-left transition ${machine.id === selectedMachine?.id ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf1f6] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                    key={machine.id}
                    onClick={() => setSelectedMachineId(machine.id)}
                    type="button"
                  >
                    <strong className="text-[13px] text-[#2f5f98]">{machine.serialNumber}</strong>
                    <span className="truncate text-[12px] text-[#657384]">{machine.modelName}</span>
                  </button>
                ))
              ) : (
                <EmptyState text={loading ? 'Đang tải danh sách máy.' : 'Không có máy phù hợp bộ lọc.'} />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf1f6] pt-3">
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dfe7ef] bg-white px-2.5 text-sm font-bold text-[#405064] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                type="button"
              >
                <ChevronLeft size={16} />
                Trước
              </button>
              <span className="text-sm font-semibold text-[#657384]">
                {technicalMachines?.page ?? page}/{technicalMachines?.totalPages ?? 1}
              </span>
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dfe7ef] bg-white px-2.5 text-sm font-bold text-[#405064] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={loading || page >= (technicalMachines?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Sau
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <MachineDetailPanel machine={selectedMachine} />
      </section>
    </PageFrame>
  );
}

function MachineDetailPanel({ machine }: { machine: DashboardMachine | null }) {
  if (!machine) {
    return (
      <aside className="rounded-lg border border-[#dfe7ef] bg-white p-6">
        <EmptyState text="Chọn S/N để xem thông tin máy." />
      </aside>
    );
  }

  const customer = machine.customer;
  const installAddress = machine.installation?.receiverInstallAddress || customer?.fullAddress || customer?.address || '';

  const accessories = machine.accessories ?? [];

  return (
    <aside className="grid min-w-0 gap-4 self-start">
      <div className="min-w-0 rounded-lg border border-[#dfe7ef] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight text-[#17202a]">Thông tin máy</h2>
            <p className="mt-1 text-lg font-semibold text-[#2f5f98]">{machine.serialNumber}</p>
          </div>
          <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef6ff] px-3 text-sm font-bold text-[#2f5f98]">
            {displayLabel(machine.inventoryStatus || machine.status || '')}
          </span>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <InfoItem label="Model" value={machine.modelName} />
          <InfoItem label="Mã máy" value={machine.machineCode} />
          <InfoItem label="Tên máy" value={machine.name || machine.modelName} />
          <InfoItem label="Hãng" value={machine.manufacturer} />
          <InfoItem label="Loại thiết bị" value={displayProductCategory(machine.productCategory)} />
          <InfoItem label="Ngày lắp" value={formatDashboardDate(machine.installDate)} />
          <InfoItem label="Hết bảo hành" value={formatDashboardDate(machine.warrantyEndDate)} />
          <InfoItem label="Kỹ sư lắp đặt" value={machine.installedBy?.fullName} />
          <InfoItem label="Kỹ sư phụ trách" value={machine.primaryEngineer?.fullName} />
        </div>

        <div className="mt-6 border-t border-[#edf1f6] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-[#17202a]">Đầu dò / Phụ kiện</h3>
            <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-sm font-bold text-[#2f5f98]">{accessories.length}</span>
          </div>
          {accessories.length ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {accessories.map((accessory) => (
                <div className="grid min-w-0 gap-2 rounded-lg border border-[#edf1f6] bg-[#fbfdff] p-4" key={accessory.id}>
                  <div className="grid gap-1">
                    <span className="text-[12px] font-semibold uppercase text-[#657384]">
                      {accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện'}
                    </span>
                    <strong className="break-words text-base font-bold leading-snug text-[#17202a]">{accessory.name}</strong>
                  </div>
                  <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 text-sm">
                    <span className="font-semibold text-[#657384]">S/N</span>
                    <strong className="break-words text-[#2f5f98]">{accessory.serialNumber || '-'}</strong>
                    <span className="font-semibold text-[#657384]">Mã</span>
                    <span className="break-words text-[#405064]">{accessory.code || accessory.componentAccessory?.code || '-'}</span>
                  </div>
                  {accessory.note || accessory.description ? (
                    <p className="text-sm leading-snug text-[#657384]">{accessory.note || accessory.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có thông tin đầu dò/phụ kiện." />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-[#dfe7ef] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <h2 className="text-2xl font-bold leading-tight text-[#17202a]">Khách hàng đã lắp máy</h2>
          {machine.installation?.code ? <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-sm font-semibold text-[#657384]">{machine.installation.code}</span> : null}
        </div>
        {customer ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <InfoItem label="Khách hàng" value={customer.hospitalName || customer.name} />
            <InfoItem label="Mã khách hàng" value={customer.customerCode} />
            <InfoItem label="Người liên hệ" value={machine.installation?.receiverRepresentative || customer.contactPerson} />
            <InfoItem label="Điện thoại" value={machine.installation?.receiverPhone || customer.contactPhone || customer.phone} />
            <InfoItem label="Tỉnh/TP" value={customer.province} />
            <InfoItem label="Địa chỉ lắp đặt" value={installAddress} />
          </div>
        ) : (
          <EmptyState text="Máy chưa có thông tin lắp đặt." />
        )}
      </div>
    </aside>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid min-w-0 gap-1.5 rounded-lg border border-[#edf1f6] bg-[#fbfdff] p-3">
      <span className="text-[12px] font-semibold uppercase text-[#657384]">{label}</span>
      <strong className="min-h-6 break-words text-base font-semibold leading-snug text-[#17202a]">{value || '-'}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fbfdff] p-4 text-sm text-[#657384]">{text}</div>;
}

function businessLineKey(businessLine?: TechnicalMachineGroup | null) {
  return businessLine?.id ?? '__unassigned__';
}

function displayProductCategory(value?: string | null) {
  return value ? displayLabel(value) : '-';
}

function formatDashboardDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}
