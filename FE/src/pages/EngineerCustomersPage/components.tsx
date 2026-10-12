import { ArrowRight, CalendarClock, ChevronDown, ChevronLeft, ClipboardList, Mail, MapPin, PackageCheck, Phone, Stethoscope, UserRound, Wrench } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import type { CustomerMachine, CustomerSummary, OpenTaskItem, TimelineItem } from './types';
import { categoryLabels, countUnique, displayStatus, formatDate, machineTitle, normalizeAccessoryList, taskKindLabel } from './utils';

export function CustomerDetailView({
  customer,
  detailLoading,
  machines,
  openTasks,
  timeline,
}: {
  customer: CustomerSummary;
  detailLoading: boolean;
  machines: CustomerMachine[];
  openTasks: OpenTaskItem[];
  timeline: TimelineItem[];
}) {
  const returnTo = encodeURIComponent(`/customers/${customer.id}`);
  const accessories = machines.flatMap((machine) =>
    (machine.accessories ?? []).map((accessory) => ({ ...accessory, machine })),
  );
  const demoMachines = machines.filter((machine) => machine.demoLoans?.length);
  const customerMachines = machines.filter((machine) => !machine.demoLoans?.length);
  const contacts = customer.contacts?.length
    ? customer.contacts
    : customer.contactPerson || customer.contactPhone || customer.contactEmail
      ? [{ id: 'legacy-primary-contact', name: customer.contactPerson || 'Liên hệ chính', position: customer.contactPosition, phone: customer.contactPhone, email: customer.contactEmail, isPrimary: true }]
      : [];
  const installationAccessories = machines.flatMap((machine) =>
    (machine.installations ?? []).flatMap((installation) =>
      normalizeAccessoryList(installation.accessories).map((name) => ({
        id: `${installation.id}-${name}`,
        name,
        machine,
        installedAt: installation.installedAt,
        code: installation.code,
      })),
    ),
  );
  const [activeSection, setActiveSection] = useState<'overview' | 'machines' | 'work' | 'accessories'>('overview');
  const [expandedWorkId, setExpandedWorkId] = useState<string | null>(null);
  const [workSearch, setWorkSearch] = useState('');
  const [workPage, setWorkPage] = useState(1);
  const allAccessoriesCount = accessories.length + installationAccessories.length;
  const totalRepairs = countUnique([
    ...machines.flatMap((machine) => machine.repairs ?? []),
    ...(customer.directRepairs ?? []),
  ]);
  const totalMaintenances = countUnique([
    ...machines.flatMap((machine) => machine.maintenances ?? []),
    ...(customer.directMaintenances ?? []),
  ]);
  const filteredTimeline = timeline.filter((item) => matchWorkSearch(item, workSearch));
  const workPageSize = 10;
  const workTotalPages = Math.max(1, Math.ceil(filteredTimeline.length / workPageSize));
  const safeWorkPage = Math.min(workPage, workTotalPages);
  const pagedTimeline = filteredTimeline.slice((safeWorkPage - 1) * workPageSize, safeWorkPage * workPageSize);
  const firstWorkIndex = filteredTimeline.length ? (safeWorkPage - 1) * workPageSize + 1 : 0;
  const lastWorkIndex = Math.min(filteredTimeline.length, safeWorkPage * workPageSize);
  const sectionTabs = [
    { id: 'overview', label: 'Tổng quan', value: openTasks.length },
    { id: 'machines', label: 'Thiết bị', value: machines.length },
    { id: 'work', label: 'Công việc', value: timeline.length },
    { id: 'accessories', label: 'Phụ kiện', value: allAccessoriesCount },
  ] as const;

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid min-w-0 gap-5 rounded-[26px] border border-[#e4e4e7] bg-white p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eeeeee] pb-5">
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-md bg-[#f4f4f5] px-2 py-1 text-xs font-bold tracking-wide text-[#52525b]">{customer.customerCode || customer.region?.name || 'Khách hàng'}</span>
            <h1 className="mt-2 [overflow-wrap:anywhere] text-[clamp(24px,3vw,32px)] font-extrabold leading-tight tracking-[-0.025em] text-[#1f1f1f]">{customer.name || customer.hospitalName}</h1>
            <p className="mt-2 flex max-w-[70ch] items-start gap-2 [overflow-wrap:anywhere] text-sm font-medium leading-6 text-[#666666]">
              <MapPin className="mt-1 shrink-0 text-[#991b2b]" size={16} />
              {customer.fullAddress || [customer.address, customer.locality, customer.ward, customer.district, customer.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}
            </p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link to="/customers"><ChevronLeft size={16} />Danh sách khách hàng</Link>
            </Button>
            <Button asChild>
              <Link to={`/service-tickets/create?kind=repair&customerId=${customer.id}&returnTo=${returnTo}`}>
                <Wrench size={16} />
                Tạo sửa chữa
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={`/service-tickets/create?kind=maintenance&customerId=${customer.id}&returnTo=${returnTo}`}>
                <CalendarClock size={16} />
                Tạo bảo trì
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<Stethoscope size={18} />} label="Máy khách đang sử dụng" value={customerMachines.length} />
          <Metric icon={<PackageCheck size={18} />} label="Máy đang demo" value={demoMachines.length} />
          <Metric icon={<Wrench size={18} />} label="Lượt sửa chữa" value={totalRepairs} />
          <Metric icon={<CalendarClock size={18} />} label="Lượt bảo trì" value={totalMaintenances} />
          <Metric icon={<PackageCheck size={18} />} label="Phụ kiện/linh kiện" value={allAccessoriesCount} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <InfoTile icon={<UserRound size={17} />} label="Kỹ sư phụ trách" value={customer.primaryEngineer?.fullName || 'Chưa gán'} hint={customer.primaryEngineer?.phone || customer.primaryEngineer?.email || ''} />
          <InfoTile icon={<Phone size={17} />} label="Liên hệ" value={customer.contactPerson || customer.phone || 'Chưa có'} hint={customer.contactPhone || customer.phone || ''} />
          <InfoTile icon={<ClipboardList size={17} />} label="Việc mở" value={`${openTasks.length}`} hint="Cần xử lý" />
        </div>
        <section className="grid min-w-0 gap-3 rounded-2xl border border-[#e4e4e7] bg-[#faf9f7] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-[#252c30]">Đầu mối liên hệ</h2>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#666666]">{contacts.length}</span>
          </div>
          {contacts.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.map((contact) => (
                <article className="min-w-0 rounded-xl border border-[#e5e5e5] bg-white p-3" key={contact.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="[overflow-wrap:anywhere] text-sm text-[#252c30]">{contact.name}</strong>
                    {contact.isPrimary ? <span className="rounded-full bg-[#f8ecee] px-2 py-0.5 text-[11px] font-bold text-[#991b2b]">Chính</span> : null}
                  </div>
                  {contact.position ? <p className="mt-1 text-xs text-[#737373]">{contact.position}</p> : null}
                  <div className="mt-2 grid gap-1 text-xs text-[#555555]">
                    {contact.phone ? <a className="inline-flex items-center gap-1.5 hover:text-[#991b2b]" href={`tel:${contact.phone}`}><Phone size={13} />{contact.phone}</a> : null}
                    {contact.email ? <a className="inline-flex items-center gap-1.5 break-all hover:text-[#991b2b]" href={`mailto:${contact.email}`}><Mail size={13} />{contact.email}</a> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="rounded-xl border border-dashed border-[#d8d8d8] bg-white px-3 py-4 text-sm text-[#777777]">Chưa có người liên hệ.</p>}
        </section>
      </div>

      <section className="rounded-[26px] border border-[#e4e4e7] bg-white p-2 shadow-[0_8px_24px_rgba(24,24,27,0.04)]">
        <div className="grid gap-2 md:grid-cols-4">
          {sectionTabs.map((tab) => (
            <button
              className={`flex min-h-12 items-center justify-between rounded-[18px] px-4 text-left text-sm font-extrabold transition ${
                activeSection === tab.id ? 'bg-[#18181b] text-white shadow-[0_12px_30px_rgba(24,24,27,0.18)]' : 'bg-[#fafafa] text-[#555555] hover:bg-[#f4f4f5]'
              }`}
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === tab.id ? 'bg-white/14 text-white' : 'bg-white text-[#18181b]'}`}>{tab.value}</span>
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'overview' ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className={panelClass}>
            <PanelTitle title="Việc cần xử lý" />
            {detailLoading ? (
              <EmptyState title="Đang tải việc đang mở..." />
            ) : openTasks.length ? (
              <div className="grid gap-3">
                {openTasks.slice(0, 4).map((task) => (
                  <TaskCompactCard key={`${task.kind}-${task.id}`} task={task} />
                ))}
              </div>
            ) : (
              <EmptyState title="Không có việc đang mở cho khách hàng này" />
            )}
          </section>
          <section className={panelClass}>
            <PanelTitle title="Thông tin khách hàng" />
            <div className="grid gap-3">
              <InfoTile icon={<ClipboardList size={17} />} label="Loại khách" value={categoryLabels[customer.customerType || ''] || customer.customerType || 'Chưa phân loại'} hint={displayStatus(customer.status)} />
              <InfoTile icon={<Stethoscope size={17} />} label="Máy khách đang sử dụng" value={customerMachines[0] ? machineTitle(customerMachines[0]) : 'Chưa có máy của khách'} hint={customerMachines[0]?.serialNumber ? `S/N ${customerMachines[0].serialNumber}` : ''} />
              <InfoTile icon={<CalendarClock size={17} />} label="Lịch sử" value={`${timeline.length} phiếu`} hint="Lắp đặt, sửa chữa, bảo trì" />
            </div>
          </section>
        </div>
      ) : null}

      {activeSection === 'machines' ? (
        <div className="grid min-w-0 gap-5">
        <section className={panelClass}>
          <PanelTitle title="Máy khách đang sử dụng" subtitle={`${customerMachines.length} máy`} />
          {detailLoading ? (
            <EmptyState title="Đang tải máy..." />
          ) : customerMachines.length ? (
            <div className="grid gap-3">
              {customerMachines.map((machine) => (
                <MachineCard customerId={customer.id} key={machine.id} machine={machine} returnTo={returnTo} />
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa ghi nhận máy thuộc khách hàng này" />
          )}
        </section>
        {demoMachines.length ? (
          <section className={panelClass}>
            <PanelTitle title="Máy khách đang mượn demo" subtitle={`${demoMachines.length} máy`} />
            <div className="grid gap-3">
              {demoMachines.map((machine) => (
                <MachineCard customerId={customer.id} key={machine.id} machine={machine} returnTo={returnTo} demo />
              ))}
            </div>
          </section>
        ) : null}
        </div>
      ) : null}

      {activeSection === 'work' ? (
        <section className={panelClass}>
          <PanelTitle title="Lịch sử công việc" subtitle={`${timeline.length} phiếu`} />
          <div className="grid gap-2 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3">
            <input
              className="h-11 rounded-xl border border-[#ded8d8] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]"
              onChange={(event) => {
                setWorkSearch(event.target.value);
                setWorkPage(1);
                setExpandedWorkId(null);
              }}
              placeholder="Tìm theo mã phiếu, máy, kỹ sư, trạng thái, ghi chú..."
              value={workSearch}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#666666]">
              <span>{filteredTimeline.length} kết quả phù hợp</span>
              <span>{filteredTimeline.length ? `Hiển thị ${firstWorkIndex}-${lastWorkIndex}` : 'Không có kết quả'}</span>
            </div>
          </div>
          {detailLoading ? (
            <EmptyState title="Đang tải lịch sử..." />
          ) : pagedTimeline.length ? (
            <div className="grid gap-3">
              {pagedTimeline.map((item) => (
                <WorkHistoryCard
                  isExpanded={expandedWorkId === `${item.kind}-${item.id}`}
                  item={item}
                  key={`${item.kind}-${item.id}`}
                  onToggle={() =>
                    setExpandedWorkId((current) =>
                      current === `${item.kind}-${item.id}` ? null : `${item.kind}-${item.id}`,
                    )
                  }
                  returnTo={returnTo}
                />
              ))}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 rounded-2xl border border-[#ded8d8] bg-white text-sm font-bold text-[#333333] transition hover:border-[#e4e4e7] hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={safeWorkPage <= 1}
                  onClick={() => {
                    setWorkPage((current) => Math.max(1, current - 1));
                    setExpandedWorkId(null);
                  }}
                  type="button"
                >
                  Trước
                </button>
                <button
                  className="h-10 rounded-2xl border border-[#ded8d8] bg-white text-sm font-bold text-[#333333] transition hover:border-[#e4e4e7] hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={safeWorkPage >= workTotalPages}
                  onClick={() => {
                    setWorkPage((current) => Math.min(workTotalPages, current + 1));
                    setExpandedWorkId(null);
                  }}
                  type="button"
                >
                  Sau
                </button>
              </div>
              <div className="text-center text-xs font-bold text-[#8a8a8a]">
                Trang {safeWorkPage}/{workTotalPages}
              </div>
            </div>
          ) : (
            <EmptyState title={timeline.length ? 'Không tìm thấy công việc phù hợp' : 'Chưa có lịch sử công việc'} />
          )}
        </section>
      ) : null}

      {activeSection === 'accessories' ? (
      <section className={panelClass}>
        <PanelTitle title="Linh kiện và phụ kiện liên quan" />
        {detailLoading ? (
          <EmptyState title="Đang tải phụ kiện..." />
        ) : accessories.length || installationAccessories.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accessories.map((accessory) => (
              <div className="grid min-w-0 gap-2 rounded-2xl border border-[#ededf0] bg-[#fafafa] p-3" key={accessory.id}>
                <span className="text-xs font-semibold text-[#18181b]">{accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện máy'}</span>
                <strong className="[overflow-wrap:anywhere] text-sm text-[#1f1f1f]">{accessory.name}</strong>
                <span className="[overflow-wrap:anywhere] text-xs leading-5 text-[#666666]">{[machineTitle(accessory.machine), accessory.serialNumber ? `S/N ${accessory.serialNumber}` : ''].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
            {installationAccessories.map((item) => (
              <div className="grid min-w-0 gap-2 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3" key={item.id}>
                <span className="text-xs font-semibold text-[#18181b]">Phụ kiện bàn giao</span>
                <strong className="[overflow-wrap:anywhere] text-sm text-[#1f1f1f]">{item.name}</strong>
                <span className="[overflow-wrap:anywhere] text-xs leading-5 text-[#666666]">{[machineTitle(item.machine), item.code, formatDate(item.installedAt)].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa ghi nhận phụ kiện hoặc linh kiện thay thế riêng cho khách hàng này" />
        )}
      </section>
      ) : null}
    </div>
  );
}

function WorkHistoryCard({
  isExpanded,
  item,
  onToggle,
  returnTo,
}: {
  isExpanded: boolean;
  item: TimelineItem;
  onToggle: () => void;
  returnTo: string;
}) {
  const machineLabel = item.machine ? machineTitle(item.machine) : item.machineLabel;
  const href = workItemHref(item, returnTo);
  const usedPartsText = formatUsedParts(item.usedParts);
  const workLogsText = formatWorkLogs(item.workLogs);
  const checklistText = formatChecklist(item.checklistItems);
  const detailRows = [
    { label: 'Mã phiếu', value: item.code },
    { label: 'Loại việc', value: item.type ? displayStatus(item.type) : taskKindLabel(item.kind) },
    { label: 'Ưu tiên', value: item.priority ? displayStatus(item.priority) : '' },
    { label: 'Ngày báo/lập', value: formatDate(item.reportedAt || item.installedAt || item.date) },
    { label: 'Lịch hẹn', value: formatDate(item.scheduledDate) },
    { label: 'Hoàn tất', value: formatDate(item.completedAt) },
    { label: 'Bảo hành đến', value: formatDate(item.warrantyEndDate) },
    { label: 'Kỹ sư/người tạo', value: item.person },
    { label: 'Thiết bị', value: machineLabel },
  ].filter((row) => row.value);
  const longNotes = [
    { label: 'Mô tả ban đầu', value: item.description },
    { label: 'Kết quả xử lý', value: item.resultNote },
    { label: 'Vật tư/phụ kiện đã dùng', value: usedPartsText },
    { label: 'Nhật ký xử lý', value: workLogsText },
    { label: 'Checklist công việc', value: checklistText },
    { label: 'Ghi chú', value: item.note && item.note !== item.description && item.note !== item.resultNote ? item.note : '' },
  ].filter((row) => row.value);

  return (
    <article className="grid min-w-0 gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#333333]">
          {item.kind === 'repair' ? <Wrench size={16} /> : item.kind === 'maintenance' ? <CalendarClock size={16} /> : item.kind === 'inventory' ? <ClipboardList size={16} /> : <Stethoscope size={16} />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="min-w-0 [overflow-wrap:anywhere] text-sm font-extrabold text-[#1f1f1f]">{item.code || item.title}</strong>
            <span className="rounded-md bg-[#f4f4f5] px-2 py-1 text-[11px] font-bold text-[#52525b]">{taskKindLabel(item.kind)}</span>
            <span className="rounded-md border border-[#e4e4e7] px-2 py-1 text-[11px] font-bold text-[#555555]">{displayStatus(item.status)}</span>
          </div>
          <span className="mt-1 block [overflow-wrap:anywhere] text-xs text-[#666666]">
            {[formatDate(item.date), machineLabel, item.person].filter(Boolean).join(' · ') || item.title}
          </span>
          {item.note ? <span className="mt-2 line-clamp-2 block [overflow-wrap:anywhere] text-xs leading-5 text-[#52525b]">{item.note}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-12 sm:pl-0">
        <Button onClick={onToggle} type="button" variant="secondary">
          {isExpanded ? 'Ẩn chi tiết' : 'Chi tiết'}
          <ChevronDown className={`transition ${isExpanded ? 'rotate-180' : ''}`} size={15} />
        </Button>
        {href ? <Button asChild variant="secondary"><Link to={href}>Mở phiếu<ArrowRight size={15} /></Link></Button> : null}
      </div>

      {isExpanded ? (
        <div className="grid gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-3 sm:ml-[46px]">
          {detailRows.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {detailRows.map((row) => (
                <div className="grid gap-1 rounded-xl bg-[#fafafa] px-3 py-2" key={row.label}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8a8a]">{row.label}</span>
                  <strong className="[overflow-wrap:anywhere] text-xs text-[#333333]">{row.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          {longNotes.length ? (
            <div className="grid gap-2">
              {longNotes.map((row) => (
                <div className="grid gap-1 rounded-xl border border-[#eeeeee] bg-white px-3 py-2" key={row.label}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8a8a]">{row.label}</span>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-xs font-medium leading-5 text-[#333333]">{row.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          {!detailRows.length && !longNotes.length ? <EmptyState title="Phiếu này chưa có thông tin chi tiết bổ sung" /> : null}
        </div>
      ) : null}
    </article>
  );
}

function formatUsedParts(parts: TimelineItem['usedParts']) {
  return (parts ?? [])
    .map((part) =>
      [
        part.name,
        part.quantity ? `SL ${part.quantity}${part.unit ? ` ${part.unit}` : ''}` : '',
        part.serialNumber ? `S/N ${part.serialNumber}` : '',
        part.note,
      ]
        .filter(Boolean)
        .join(' - '),
    )
    .filter(Boolean)
    .join('\n');
}

function formatWorkLogs(logs: TimelineItem['workLogs']) {
  return (logs ?? [])
    .map((log) => [log.title, log.note].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join('\n');
}

function formatChecklist(items: TimelineItem['checklistItems']) {
  return (items ?? [])
    .map((item) => [item.label, item.status ? displayStatus(item.status) : ''].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join('\n');
}

function workItemHref(item: TimelineItem, returnTo: string) {
  if (item.kind === 'inventory') {
    return '';
  }

  if (item.kind === 'installation') {
    return `/installations/${item.id}/update?returnTo=${returnTo}`;
  }

  if (item.kind === 'maintenance') {
    return `/maintenance/${item.id}/update?returnTo=${returnTo}`;
  }

  return `/repairs/${item.id}/update?returnTo=${returnTo}`;
}

function matchWorkSearch(item: TimelineItem, search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const machineLabel = item.machine ? machineTitle(item.machine) : item.machineLabel;
  const haystack = [
    item.title,
    item.code,
    item.description,
    item.note,
    item.resultNote,
    item.person,
    item.priority,
    item.type,
    item.status,
    displayStatus(item.status),
    displayStatus(item.priority),
    displayStatus(item.type),
    machineLabel,
    item.machine?.machineCode,
    item.machine?.serialNumber,
    item.machine?.modelName,
    item.machine?.name,
    taskKindLabel(item.kind),
    formatDate(item.date),
    formatDate(item.reportedAt),
    formatDate(item.scheduledDate),
    formatDate(item.completedAt),
    formatDate(item.installedAt),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(keyword);
}

function TaskCompactCard({ task }: { task: OpenTaskItem }) {
  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#18181b]">{taskKindLabel(task.kind)}</span>
          <strong className="mt-1 block [overflow-wrap:anywhere] text-sm text-[#1f1f1f]">{task.title}</strong>
        </div>
        <span className="rounded-lg border border-[#ededf0] bg-white px-2 py-1 text-[11px] font-bold text-[#555555]">{displayStatus(task.status)}</span>
      </div>
      <span className="min-w-0 [overflow-wrap:anywhere] text-xs leading-5 text-[#666666]">
        {[formatDate(task.date), task.machine ? machineTitle(task.machine) : task.machineLabel].filter(Boolean).join(' - ') || 'Chưa có thông tin máy'}
      </span>
      <Button asChild className="justify-center" variant="secondary">
        <Link to={task.href}>Cập nhật phiếu</Link>
      </Button>
    </div>
  );
}

function MachineCard({ customerId, machine, returnTo, demo = false }: { customerId: string; machine: CustomerMachine; returnTo: string; demo?: boolean }) {
  const demoLoan = machine.demoLoans?.[0];
  return (
    <article className="grid min-w-0 gap-3 rounded-[22px] border border-[#ededf0] bg-[#fafafa] p-4 transition hover:border-[#e4e4e7] hover:bg-[#fafafa]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block [overflow-wrap:anywhere] text-sm text-[#1f1f1f]">{machineTitle(machine)}</strong>
          <span className="mt-1 block [overflow-wrap:anywhere] text-xs text-[#666666]">{[categoryLabels[machine.productCategory || ''], machine.manufacturer, machine.serialNumber ? `S/N ${machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa đủ thông tin máy'}</span>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${demo ? 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]' : 'border-[#ededf0] bg-white text-[#333333]'}`}>{demo ? 'Đang demo' : displayStatus(machine.inventoryStatus || machine.status)}</span>
      </div>
      <div className="grid gap-2 text-xs text-[#666666] sm:grid-cols-3">
        {demo ? <span>Phiếu demo: <b className="font-semibold text-[#333333]">{demoLoan?.ticketCode || demoLoan?.code || '-'}</b></span> : <span>Lắp đặt: <b className="font-semibold text-[#333333]">{formatDate(machine.installDate) || '-'}</b></span>}
        {demo ? <span>Dự kiến thu hồi: <b className="font-semibold text-[#333333]">{formatDate(demoLoan?.expectedReturnAt) || '-'}</b></span> : <span>Bảo hành: <b className="font-semibold text-[#333333]">{formatDate(machine.warrantyEndDate) || '-'}</b></span>}
        <span>Kỹ sư máy: <b className="font-semibold text-[#333333]">{machine.primaryEngineer?.fullName || machine.installedBy?.fullName || '-'}</b></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {demo ? (
          <Button asChild variant="secondary">
            <Link to="/service-tickets?type=demo">Xem phiếu demo</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link to={`/technical-machines/${machine.id}`}>
            Xem máy
            <ArrowRight size={15} />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={`/service-tickets/create?kind=repair&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>Sửa chữa</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={`/service-tickets/create?kind=maintenance&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>Bảo trì</Link>
        </Button>
      </div>
    </article>
  );
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#18181b] shadow-[inset_0_0_0_1px_#e4e4e7]">{icon}</div>
      <div>
        <strong className="block text-xl font-extrabold leading-tight text-[#1f1f1f]">{value}</strong>
        <span className="text-xs font-bold text-[#666666]">{label}</span>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#ededf0] bg-[#fafafa] p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#18181b] shadow-[inset_0_0_0_1px_#eeeeee]">{icon}</div>
      <div className="min-w-0">
        <span className="text-xs font-bold text-[#666666]">{label}</span>
        <strong className="block truncate text-sm font-extrabold text-[#1f1f1f]">{value}</strong>
        {hint ? <span className="block truncate text-xs text-[#8a8a8a]">{hint}</span> : null}
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-base font-extrabold text-[#1f1f1f]">{title}</h3>
      {subtitle ? <span className="text-xs font-semibold text-[#666666]">{subtitle}</span> : null}
    </div>
  );
}

export function EmptyState({ title }: { title: string }) {
  return <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafafa] px-4 py-6 text-center text-sm font-bold text-[#666666]">{title}</div>;
}

const panelClass = 'grid min-w-0 content-start gap-3 rounded-[26px] border border-[#e4e4e7] bg-white p-5 shadow-[0_18px_50px_rgba(24,24,27,0.05)]';
