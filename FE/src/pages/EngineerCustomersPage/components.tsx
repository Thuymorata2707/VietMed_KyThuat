import { ArrowRight, CalendarClock, ClipboardList, Phone, Stethoscope, UserRound, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CustomerMachine, CustomerSummary, OpenTaskItem, TimelineItem } from './types';
import { categoryLabels, displayStatus, formatDate, machineTitle, normalizeAccessoryList, taskKindLabel } from './utils';

export function CustomerDetailView({
  customer,
  detailLoading,
  isAdminProfile,
  machines,
  openTasks,
  timeline,
}: {
  customer: CustomerSummary;
  detailLoading: boolean;
  isAdminProfile: boolean;
  machines: CustomerMachine[];
  openTasks: OpenTaskItem[];
  timeline: TimelineItem[];
}) {
  const returnTo = encodeURIComponent(isAdminProfile ? `/customers/profile?customerId=${customer.id}` : '/my-customers');
  const accessories = machines.flatMap((machine) =>
    (machine.accessories ?? []).map((accessory) => ({ ...accessory, machine })),
  );
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

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#666666]">{customer.customerCode || customer.region?.name || 'Khách hàng'}</span>
            <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">{customer.hospitalName || customer.name}</h2>
            <p className="mt-1 text-sm leading-6 text-[#666666]">{customer.fullAddress || [customer.address, customer.district, customer.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="primary-button" to={`/service-tickets/create?kind=repair&customerId=${customer.id}&returnTo=${returnTo}`}>
              <Wrench size={16} />
              Tạo sửa chữa
            </Link>
            <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&customerId=${customer.id}&returnTo=${returnTo}`}>
              <CalendarClock size={16} />
              Tạo bảo trì
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoTile icon={<UserRound size={17} />} label="Kỹ sư phụ trách" value={customer.primaryEngineer?.fullName || 'Chưa gán'} hint={customer.primaryEngineer?.phone || customer.primaryEngineer?.email || ''} />
          <InfoTile icon={<Phone size={17} />} label="Liên hệ" value={customer.contactPerson || customer.phone || 'Chưa có'} hint={customer.contactPhone || customer.phone || ''} />
          <InfoTile icon={<ClipboardList size={17} />} label="Trạng thái khách hàng" value={displayStatus(customer.status)} hint={categoryLabels[customer.customerType || ''] || customer.customerType || ''} />
        </div>
      </div>

      <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <PanelTitle title="Việc đang mở" subtitle="Các phiếu cần xử lý, đang làm hoặc chờ xác nhận của khách hàng này" />
        {detailLoading ? (
          <EmptyState title="Đang tải việc đang mở..." />
        ) : openTasks.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {openTasks.map((task) => (
              <div className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={`${task.kind}-${task.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#d71920]">{taskKindLabel(task.kind)}</span>
                    <strong className="mt-1 block text-sm text-[#1f1f1f]">{task.title}</strong>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#555555]">{displayStatus(task.status)}</span>
                </div>
                <span className="text-xs leading-5 text-[#666666]">
                  {[formatDate(task.date), task.machine ? machineTitle(task.machine) : task.machineLabel, task.person].filter(Boolean).join(' - ') || 'Chưa có thông tin máy/kỹ sư'}
                </span>
                {task.note ? <p className="line-clamp-2 text-xs leading-5 text-[#666666]">{task.note}</p> : null}
                <Link className="secondary-button justify-center" to={task.href}>
                  Cập nhật phiếu
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Không có việc đang mở cho khách hàng này" />
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <PanelTitle title="Máy đang quản lý" subtitle={`${machines.length} máy gắn với khách hàng này`} />
          {detailLoading ? (
            <EmptyState title="Đang tải máy..." />
          ) : machines.length ? (
            <div className="grid gap-3">
              {machines.map((machine) => (
                <MachineCard customerId={customer.id} key={machine.id} machine={machine} returnTo={returnTo} />
              ))}
            </div>
          ) : (
            <EmptyState title="Khách hàng này chưa có máy trong dữ liệu" />
          )}
        </section>

        <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <PanelTitle title="Lịch sử công việc" subtitle="Lắp đặt, sửa chữa và bảo trì gần nhất" />
          {detailLoading ? (
            <EmptyState title="Đang tải lịch sử..." />
          ) : timeline.length ? (
            <div className="grid gap-3">
              {timeline.map((item) => (
                <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={`${item.kind}-${item.id}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">
                    {item.kind === 'repair' ? <Wrench size={16} /> : item.kind === 'maintenance' ? <CalendarClock size={16} /> : item.kind === 'inventory' ? <ClipboardList size={16} /> : <Stethoscope size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-[#1f1f1f]">{item.title}</strong>
                      <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#555555]">{displayStatus(item.status)}</span>
                    </div>
                    <span className="mt-1 block text-xs text-[#666666]">
                      {[formatDate(item.date), item.machine ? machineTitle(item.machine) : item.machineLabel, item.person].filter(Boolean).join(' - ')}
                    </span>
                    {item.note ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#666666]">{item.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có lịch sử công việc" />
          )}
        </section>
      </div>

      <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <PanelTitle title="Linh kiện và phụ kiện liên quan" subtitle="Phụ kiện đang gắn trên máy, phụ kiện bàn giao khi lắp đặt và ghi chú kho gần nhất" />
        {detailLoading ? (
          <EmptyState title="Đang tải phụ kiện..." />
        ) : accessories.length || installationAccessories.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accessories.map((accessory) => (
              <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={accessory.id}>
                <span className="text-xs font-semibold text-[#d71920]">{accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện máy'}</span>
                <strong className="text-sm text-[#1f1f1f]">{accessory.name}</strong>
                <span className="text-xs leading-5 text-[#666666]">{[machineTitle(accessory.machine), accessory.serialNumber ? `S/N ${accessory.serialNumber}` : '', accessory.note || accessory.description].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
            {installationAccessories.map((item) => (
              <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-[#fffafa] p-3" key={item.id}>
                <span className="text-xs font-semibold text-[#d71920]">Phụ kiện bàn giao</span>
                <strong className="text-sm text-[#1f1f1f]">{item.name}</strong>
                <span className="text-xs leading-5 text-[#666666]">{[machineTitle(item.machine), item.code, formatDate(item.installedAt)].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa ghi nhận phụ kiện hoặc linh kiện thay thế riêng cho khách hàng này" />
        )}
      </section>
    </div>
  );
}

function MachineCard({ customerId, machine, returnTo }: { customerId: string; machine: CustomerMachine; returnTo: string }) {
  return (
    <article className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm text-[#1f1f1f]">{machineTitle(machine)}</strong>
          <span className="mt-1 block text-xs text-[#666666]">{[categoryLabels[machine.productCategory || ''], machine.manufacturer, machine.serialNumber ? `S/N ${machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa đủ thông tin máy'}</span>
        </div>
        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#333333]">{displayStatus(machine.inventoryStatus || machine.status)}</span>
      </div>
      <div className="grid gap-2 text-xs text-[#666666] sm:grid-cols-3">
        <span>Lắp đặt: <b className="font-semibold text-[#333333]">{formatDate(machine.installDate) || '-'}</b></span>
        <span>Bảo hành: <b className="font-semibold text-[#333333]">{formatDate(machine.warrantyEndDate) || '-'}</b></span>
        <span>Kỹ sư máy: <b className="font-semibold text-[#333333]">{machine.primaryEngineer?.fullName || machine.installedBy?.fullName || '-'}</b></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="secondary-button" to={`/technical-machines/${machine.id}`}>
          Xem máy
          <ArrowRight size={15} />
        </Link>
        <Link className="secondary-button" to={`/service-tickets/create?kind=repair&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>
          Sửa chữa
        </Link>
        <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>
          Bảo trì
        </Link>
      </div>
    </article>
  );
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">{icon}</div>
      <div>
        <strong className="block text-lg leading-tight text-[#1f1f1f]">{value}</strong>
        <span className="text-xs font-medium text-[#666666]">{label}</span>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">{icon}</div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-[#666666]">{label}</span>
        <strong className="block truncate text-sm text-[#1f1f1f]">{value}</strong>
        {hint ? <span className="block truncate text-xs text-[#8a8a8a]">{hint}</span> : null}
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[#1f1f1f]">{title}</h3>
      <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
    </div>
  );
}

export function EmptyState({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-[#dddddd] bg-[#fafafa] px-4 py-6 text-center text-sm font-medium text-[#666666]">{title}</div>;
}
