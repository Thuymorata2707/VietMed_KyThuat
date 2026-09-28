import { ArrowRight, FileText, MapPin, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleMapsDirectionsButton } from '../../../components/VietnamAddressSelects';
import { drawerFieldClass, drawerInputClass, drawerTextareaClass } from '../constants';
import type { AttachmentType, ComponentAccessoryOption, EngineerTask, TaskAttachment } from '../types';
import {
  deviceConditionLabel,
  formatDate,
  installationExtraItems,
  reviewStatusLabel,
  statusLabel,
  taskCustomer,
  taskDate,
  taskKindLabel,
  taskModelText,
  taskPrimaryMachineName,
  taskSerialText,
  taskTitle,
  taskUpdateHref,
  warrantyStatusLabel,
} from '../utils';
import { TaskAttachmentsPanel } from './TaskAttachmentsPanel';

type TaskProfileCompleteness = {
  percent: number;
  missing: string[];
};

type TodayTaskSummary = {
  total: number;
  done: number;
  open: number;
  items: EngineerTask[];
};

type EngineerTaskDrawerProps = {
  accessoryOptions: ComponentAccessoryOption[];
  attachmentDescription: string;
  attachmentFiles: File[];
  attachmentTitle: string;
  attachmentType: AttachmentType;
  attachments: TaskAttachment[];
  checkedChecklist: Record<string, boolean>;
  checklistLines: string[];
  checkedChecklistLines: string[];
  completeness: TaskProfileCompleteness | null;
  fileInputKey: number;
  loadingAccessoryOptions: boolean;
  loadingAttachments: boolean;
  mapAddress: string;
  materialsText: string;
  machineHistory: EngineerTask[];
  savingKnowledge: boolean;
  savingWorkspace: boolean;
  task: EngineerTask;
  todaySummary: TodayTaskSummary;
  uploadingAttachment: boolean;
  workLogText: string;
  onAppendAccessoryMaterial: (accessoryId: string) => void;
  onAttachmentDescriptionChange: (value: string) => void;
  onAttachmentDownload: (attachment: TaskAttachment) => void;
  onAttachmentFilesChange: (files: File[]) => void;
  onAttachmentTitleChange: (value: string) => void;
  onAttachmentTypeChange: (type: AttachmentType) => void;
  onAttachmentUpload: () => void;
  onAttachmentView: (attachment: TaskAttachment) => void;
  onChecklistLineChange: (line: string, checked: boolean) => void;
  onClose: () => void;
  onCreateKnowledge: () => void;
  onMaterialsTextChange: (value: string) => void;
  onSaveWorkspace: () => void;
  onWorkLogTextChange: (value: string) => void;
};

export function EngineerTaskDrawer({
  accessoryOptions,
  attachmentDescription,
  attachmentFiles,
  attachmentTitle,
  attachmentType,
  attachments,
  checkedChecklist,
  checklistLines,
  checkedChecklistLines,
  completeness,
  fileInputKey,
  loadingAccessoryOptions,
  loadingAttachments,
  mapAddress,
  materialsText,
  machineHistory,
  savingKnowledge,
  savingWorkspace,
  task,
  todaySummary,
  uploadingAttachment,
  workLogText,
  onAppendAccessoryMaterial,
  onAttachmentDescriptionChange,
  onAttachmentDownload,
  onAttachmentFilesChange,
  onAttachmentTitleChange,
  onAttachmentTypeChange,
  onAttachmentUpload,
  onAttachmentView,
  onChecklistLineChange,
  onClose,
  onCreateKnowledge,
  onMaterialsTextChange,
  onSaveWorkspace,
  onWorkLogTextChange,
}: EngineerTaskDrawerProps) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-[rgba(24,24,27,0.34)]" onClick={onClose} role="presentation">
      <aside
        aria-modal="true"
        className="grid w-[680px] max-w-full grid-rows-[auto_auto_auto_1fr] overflow-y-auto bg-white p-6 font-sans shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <DrawerHeader onClose={onClose} task={task} />
        <DrawerSummary task={task} />
        <EngineerWorkBench
          accessoryOptions={accessoryOptions}
          checkedChecklist={checkedChecklist}
          checkedChecklistLines={checkedChecklistLines}
          checklistLines={checklistLines}
          completeness={completeness}
          loadingAccessoryOptions={loadingAccessoryOptions}
          mapAddress={mapAddress}
          materialsText={materialsText}
          machineHistory={machineHistory}
          savingKnowledge={savingKnowledge}
          savingWorkspace={savingWorkspace}
          task={task}
          todaySummary={todaySummary}
          workLogText={workLogText}
          onAppendAccessoryMaterial={onAppendAccessoryMaterial}
          onChecklistLineChange={onChecklistLineChange}
          onCreateKnowledge={onCreateKnowledge}
          onMaterialsTextChange={onMaterialsTextChange}
          onSaveWorkspace={onSaveWorkspace}
          onWorkLogTextChange={onWorkLogTextChange}
        />

        <TaskKindDetails task={task} />
        <OpenUpdatePagePanel task={task} />
        <TaskAttachmentsPanel
          attachmentDescription={attachmentDescription}
          attachmentFiles={attachmentFiles}
          attachmentTitle={attachmentTitle}
          attachmentType={attachmentType}
          attachments={attachments}
          fileInputKey={fileInputKey}
          loadingAttachments={loadingAttachments}
          onDescriptionChange={onAttachmentDescriptionChange}
          onDownload={onAttachmentDownload}
          onFilesChange={onAttachmentFilesChange}
          onTitleChange={onAttachmentTitleChange}
          onTypeChange={onAttachmentTypeChange}
          onUpload={onAttachmentUpload}
          onView={onAttachmentView}
          task={task}
          uploadingAttachment={uploadingAttachment}
        />
      </aside>
    </div>
  );
}

function DrawerHeader({ onClose, task }: { onClose: () => void; task: EngineerTask }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-[12px] font-bold text-[#18181b]">{taskKindLabel(task.kind)}</span>
        <h2 className="mt-1 text-[clamp(22px,2.4vw,30px)] leading-[1.12] tracking-[-0.04em] text-[#1f1f1f] [text-wrap:balance]">{taskTitle(task)}</h2>
      </div>
      <button className="task-close h-[34px] w-[34px] rounded-lg border border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]" onClick={onClose} title="Đóng" type="button">
        <X size={16} />
      </button>
    </div>
  );
}

function DrawerSummary({ task }: { task: EngineerTask }) {
  return (
    <>
      <div className="mt-[18px] grid grid-cols-2 gap-2.5 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3 max-[760px]:grid-cols-1">
        <div className="grid min-w-0 gap-1 rounded-xl border border-[#ededf0] bg-white p-2.5">
          <span className="text-[11px] font-extrabold text-[#64748b]">Thiết bị</span>
          <strong className="text-[14px] leading-tight text-[#18181b] [overflow-wrap:anywhere]">{taskPrimaryMachineName(task)}</strong>
        </div>
        <div className="grid min-w-0 gap-1 rounded-xl border border-[#ededf0] bg-white p-2.5">
          <span className="text-[11px] font-extrabold text-[#64748b]">Ngày hẹn</span>
          <strong className="text-[14px] leading-tight text-[#18181b] [overflow-wrap:anywhere]">{taskDate(task)}</strong>
        </div>
      </div>

      <dl className="task-detail-grid">
        <div>
          <dt>Mã phiếu</dt>
          <dd>{task.code}</dd>
        </div>
        <div>
          <dt>Thiết bị</dt>
          <dd>{task.machine?.machineCode || task.machine?.serialNumber || '-'}</dd>
        </div>
        <div>
          <dt>Khách hàng</dt>
          <dd>{taskCustomer(task) || '-'}</dd>
        </div>
        <div>
          <dt>Trạng thái hiện tại</dt>
          <dd>{statusLabel(task.status)}</dd>
        </div>
        {task.reviewStatus && task.reviewStatus !== 'NOT_REQUIRED' ? (
          <div>
            <dt>Kiểm duyệt admin</dt>
            <dd>{reviewStatusLabel(task.reviewStatus)}</dd>
          </div>
        ) : null}
      </dl>

      {task.reviewNote ? (
        <div className="task-info-block">
          <h3>Phản hồi admin</h3>
          <p>{task.reviewNote}</p>
        </div>
      ) : null}
    </>
  );
}

function EngineerWorkBench({
  accessoryOptions,
  checkedChecklist,
  checkedChecklistLines,
  checklistLines,
  completeness,
  loadingAccessoryOptions,
  mapAddress,
  materialsText,
  machineHistory,
  savingKnowledge,
  savingWorkspace,
  task,
  todaySummary,
  workLogText,
  onAppendAccessoryMaterial,
  onChecklistLineChange,
  onCreateKnowledge,
  onMaterialsTextChange,
  onSaveWorkspace,
  onWorkLogTextChange,
}: {
  accessoryOptions: ComponentAccessoryOption[];
  checkedChecklist: Record<string, boolean>;
  checkedChecklistLines: string[];
  checklistLines: string[];
  completeness: TaskProfileCompleteness | null;
  loadingAccessoryOptions: boolean;
  mapAddress: string;
  materialsText: string;
  machineHistory: EngineerTask[];
  savingKnowledge: boolean;
  savingWorkspace: boolean;
  task: EngineerTask;
  todaySummary: TodayTaskSummary;
  workLogText: string;
  onAppendAccessoryMaterial: (accessoryId: string) => void;
  onChecklistLineChange: (line: string, checked: boolean) => void;
  onCreateKnowledge: () => void;
  onMaterialsTextChange: (value: string) => void;
  onSaveWorkspace: () => void;
  onWorkLogTextChange: (value: string) => void;
}) {
  return (
    <section className="mt-5 grid gap-4 rounded-[18px] border border-[#e4e4e7] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3 max-[760px]:flex-col">
        <div>
          <span className="text-[12px] font-bold text-[#18181b]">Bàn làm việc kỹ sư</span>
          <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">Checklist, vật tư, nhật ký và hồ sơ máy</h3>
        </div>
        {completeness ? (
          <div className="grid min-w-[140px] gap-1 rounded-xl border border-[#e4e4e7] bg-[#f8fafc] p-2.5 text-right max-[760px]:w-full max-[760px]:text-left">
            <span className="text-[11px] font-extrabold text-[#64748b]">Độ đầy đủ hồ sơ</span>
            <strong className="text-[22px] leading-none text-[#18181b]">{completeness.percent}%</strong>
          </div>
        ) : null}
      </div>

      {completeness?.missing.length ? (
        <div className="flex flex-wrap gap-2">
          {completeness.missing.map((item) => (
            <span className="rounded-full border border-[#fecdd3] bg-[#fff1f3] px-2.5 py-1 text-[12px] font-bold text-[#b5121b]" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#b9e8ca] bg-[#eefaf3] px-3 py-2 text-[13px] font-bold text-[#177245]">
          Hồ sơ đã đủ thông tin chính để admin kiểm duyệt.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
        <ChecklistCard checkedChecklist={checkedChecklist} checkedLines={checkedChecklistLines} lines={checklistLines} onChange={onChecklistLineChange} />
        <WorkNotesFields
          accessoryOptions={accessoryOptions}
          loadingAccessoryOptions={loadingAccessoryOptions}
          materialsText={materialsText}
          task={task}
          workLogText={workLogText}
          onAppendAccessoryMaterial={onAppendAccessoryMaterial}
          onMaterialsTextChange={onMaterialsTextChange}
          onWorkLogTextChange={onWorkLogTextChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
        <MachineMiniProfile history={machineHistory} task={task} />
        <RouteAndDailySummary address={mapAddress} summary={todaySummary} />
      </div>

      <div className="flex justify-end gap-2.5 max-[760px]:flex-col">
        <Link className="task-secondary" to="/daily-work?tab=daily">
          <FileText size={16} />
          Báo cáo cuối ngày
        </Link>
        <button className="task-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingWorkspace} onClick={onSaveWorkspace} type="button">
          {savingWorkspace ? 'Đang lưu' : 'Lưu bàn làm việc'}
        </button>
        <button className="task-primary gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingKnowledge} onClick={onCreateKnowledge} type="button">
          <Plus size={16} />
          {savingKnowledge ? 'Đang tạo' : 'Lưu thành kinh nghiệm'}
        </button>
      </div>
    </section>
  );
}

function ChecklistCard({
  checkedChecklist,
  checkedLines,
  lines,
  onChange,
}: {
  checkedChecklist: Record<string, boolean>;
  checkedLines: string[];
  lines: string[];
  onChange: (line: string, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[14px] text-[#18181b]">Checklist theo loại việc</strong>
        <span className="text-[12px] font-bold text-[#64748b]">{checkedLines.length}/{lines.length}</span>
      </div>
      <div className="grid max-h-[250px] gap-2 overflow-auto pr-1">
        {lines.map((line) => (
          <label className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[#ececec] bg-white p-2.5 text-[13px] font-semibold leading-snug text-[#333333]" key={line}>
            <input checked={Boolean(checkedChecklist[line])} className="mt-[2px]" onChange={(event) => onChange(line, event.target.checked)} type="checkbox" />
            <span>{line}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function WorkNotesFields({
  accessoryOptions,
  loadingAccessoryOptions,
  materialsText,
  task,
  workLogText,
  onAppendAccessoryMaterial,
  onMaterialsTextChange,
  onWorkLogTextChange,
}: {
  accessoryOptions: ComponentAccessoryOption[];
  loadingAccessoryOptions: boolean;
  materialsText: string;
  task: EngineerTask;
  workLogText: string;
  onAppendAccessoryMaterial: (accessoryId: string) => void;
  onMaterialsTextChange: (value: string) => void;
  onWorkLogTextChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className={drawerFieldClass}>
        Linh kiện/vật tư sử dụng
        {task.kind === 'repair' || task.kind === 'maintenance' ? (
          <select
            className={drawerInputClass}
            disabled={loadingAccessoryOptions || accessoryOptions.length === 0}
            onChange={(event) => {
              onAppendAccessoryMaterial(event.target.value);
              event.target.value = '';
            }}
            value=""
          >
            <option value="">
              {loadingAccessoryOptions
                ? 'Đang tải phụ kiện theo model...'
                : accessoryOptions.length
                  ? 'Chọn phụ kiện từ danh mục'
                  : 'Chưa có phụ kiện theo model này'}
            </option>
            {accessoryOptions.map((accessory) => (
              <option key={accessory.id} value={accessory.id}>
                {[accessory.name, accessory.code, accessory.component?.name, accessory.machineModel?.code].filter(Boolean).join(' - ')}
              </option>
            ))}
          </select>
        ) : null}
        <textarea
          className={drawerTextareaClass}
          onChange={(event) => onMaterialsTextChange(event.target.value)}
          placeholder="Tên linh kiện | SL | Serial | Giá bán | Ghi chú"
          value={materialsText}
        />
      </label>
      <label className={drawerFieldClass}>
        Nhật ký xử lý theo bước
        <textarea
          className={drawerTextareaClass}
          onChange={(event) => onWorkLogTextChange(event.target.value)}
          placeholder="09:00 - Kiểm tra nguồn&#10;09:20 - Xác định lỗi&#10;10:00 - Test lại và bàn giao"
          value={workLogText}
        />
      </label>
    </div>
  );
}

function MachineMiniProfile({ history, task }: { history: EngineerTask[]; task: EngineerTask }) {
  return (
    <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
      <strong className="text-[14px] text-[#18181b]">Hồ sơ máy mini</strong>
      <dl className="grid gap-2 text-[13px]">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
          <dt className="font-bold text-[#64748b]">Máy</dt>
          <dd className="[overflow-wrap:anywhere]">{taskPrimaryMachineName(task)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
          <dt className="font-bold text-[#64748b]">Model/SN</dt>
          <dd className="[overflow-wrap:anywhere]">{taskModelText(task) || '-'} / {taskSerialText(task) || task.machine?.serialNumber || '-'}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
          <dt className="font-bold text-[#64748b]">Gần đây</dt>
          <dd>
            {history.length ? (
              <div className="grid gap-1.5">
                {history.map((item) => (
                  <span className="rounded-lg border border-[#e4e4e7] bg-white px-2 py-1" key={`${item.kind}-${item.id}`}>
                    {taskDate(item)} · {taskKindLabel(item.kind)} · {statusLabel(item.status)}
                  </span>
                ))}
              </div>
            ) : (
              'Chưa có lịch sử gần đây'
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function RouteAndDailySummary({ address, summary }: { address: string; summary: TodayTaskSummary }) {
  return (
    <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
      <strong className="text-[14px] text-[#18181b]">Tuyến đường và báo cáo ngày</strong>
      <div className="grid gap-2 text-[13px] text-[#333333]">
        <span className="inline-flex items-start gap-2">
          <MapPin className="mt-[1px] shrink-0 text-[#64748b]" size={15} />
          <span className="[overflow-wrap:anywhere]">{address || 'Chưa có địa chỉ để mở bản đồ'}</span>
        </span>
        {address ? <GoogleMapsDirectionsButton address={address} className="task-secondary justify-self-start" /> : null}
        <div className="grid grid-cols-3 gap-2">
          <span className="rounded-lg border border-[#e4e4e7] bg-white p-2 text-center"><b>{summary.total}</b><br />việc hôm nay</span>
          <span className="rounded-lg border border-[#b9e8ca] bg-white p-2 text-center"><b>{summary.done}</b><br />đã xong</span>
          <span className="rounded-lg border border-[#efd8a8] bg-white p-2 text-center"><b>{summary.open}</b><br />còn lại</span>
        </div>
        {summary.items.length ? (
          <div className="grid gap-1">
            {summary.items.map((item) => (
              <span className="text-[12px] font-semibold text-[#666666]" key={`${item.kind}-${item.id}`}>{taskDate(item)} · {taskTitle(item)}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskKindDetails({ task }: { task: EngineerTask }) {
  return (
    <>
      {task.kind === 'repair' ? <RepairDetails task={task} /> : null}
      {task.kind === 'maintenance' ? <MaintenanceDetails task={task} /> : null}
      {task.kind === 'maintenance' && task.checklist?.length ? <SimpleListBlock items={task.checklist} title="Checklist bảo trì" /> : null}
      {task.kind === 'installation' && task.accessories?.length ? <SimpleListBlock items={task.accessories} title="Phụ kiện lắp đặt" /> : null}
      {task.kind === 'installation' ? <InstallationDetails task={task} /> : null}
    </>
  );
}

function RepairDetails({ task }: { task: Extract<EngineerTask, { kind: 'repair' }> }) {
  return (
    <div className="task-info-block">
      <h3>Thông tin phiếu sửa chữa tại chỗ</h3>
      <dl className="task-repair-detail-grid">
        <DetailItem label="Người tạo phiếu" value={task.createdBy?.fullName || task.createdBy?.email || '-'} />
        <DetailItem label="Đơn vị sử dụng" value={task.usingDepartment || '-'} />
        <DetailItem label="Người đại diện" value={task.representative || '-'} />
        <DetailItem label="Số điện thoại" value={task.contactPhone || '-'} />
        <DetailItem label="Địa chỉ" value={task.address || '-'} wide />
        <DetailItem label="Tên thiết bị" value={task.deviceName || task.machine?.modelName || '-'} />
        <DetailItem label="Model" value={task.modelName || task.machine?.modelName || '-'} />
        <DetailItem label="S/N" value={task.serialNumber || task.machine?.serialNumber || '-'} />
        <DetailItem label="Bảo hành" value={warrantyStatusLabel(task.warrantyStatus)} />
        <DetailItem label="Kiểm tra tình trạng thiết bị" value={task.conditionAssessment || '-'} wide />
        <DetailItem label="Phương pháp sửa chữa" value={task.repairMethod || '-'} wide />
      </dl>
    </div>
  );
}

function MaintenanceDetails({ task }: { task: Extract<EngineerTask, { kind: 'maintenance' }> }) {
  return (
    <div className="task-info-block">
      <h3>Thông tin phiếu bảo trì</h3>
      <dl className="task-repair-detail-grid">
        <DetailItem label="Đơn vị sử dụng" value={task.usingDepartment || '-'} />
        <DetailItem label="Người đại diện" value={task.representative || '-'} />
        <DetailItem label="Số điện thoại" value={task.contactPhone || '-'} />
        <DetailItem label="Địa chỉ" value={task.address || '-'} wide />
        <DetailItem label="Tên thiết bị" value={task.deviceName || task.machine?.modelName || '-'} />
        <DetailItem label="Model" value={task.modelName || task.machine?.modelName || '-'} />
        <DetailItem label="S/N" value={task.serialNumber || task.machine?.serialNumber || '-'} />
      </dl>
    </div>
  );
}

function InstallationDetails({ task }: { task: Extract<EngineerTask, { kind: 'installation' }> }) {
  const extraItems = installationExtraItems(task);

  return (
    <div className="task-info-block">
      <h3>Phiếu bàn giao và bảo hành thiết bị</h3>
      <dl className="task-repair-detail-grid">
        <DetailItem label="Người lắp đặt" value={task.handoverInstallerName || '-'} />
        <DetailItem label="Chức vụ bên bàn giao" value={task.handoverInstallerPosition || '-'} />
        <DetailItem label="Phương tiện đi" value={task.handoverVehicle || '-'} />
        <DetailItem label="Ngày đi" value={task.handoverDepartureDate ? formatDate(task.handoverDepartureDate) : '-'} />
        <DetailItem label="Địa chỉ lắp đặt" value={task.receiverInstallAddress || '-'} wide />
        <DetailItem label="Người đại diện" value={task.receiverRepresentative || '-'} />
        <DetailItem label="Chức vụ bên nhận" value={task.receiverPosition || '-'} />
        <DetailItem label="SĐT bên nhận" value={task.receiverPhone || '-'} />
        <DetailItem label="Tình trạng thiết bị" value={deviceConditionLabel(task.deviceCondition, task.deviceConditionNote)} wide />
      </dl>
      {extraItems.length ? <InstalledDeviceItemsTable items={extraItems} /> : null}
    </div>
  );
}

function SimpleListBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="task-info-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DetailItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'wide-detail' : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function InstalledDeviceItemsTable({ items }: { items: ReturnType<typeof installationExtraItems> }) {
  return (
    <div className="installed-device-table">
      <table>
        <thead>
          <tr>
            <th>Tên hàng</th>
            <th>Model</th>
            <th>S/N</th>
            <th>NSX</th>
            <th>SL</th>
            <th>Bảo hành</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.itemName}-${index}`}>
              <td>{item.itemName || '-'}</td>
              <td>{item.model || '-'}</td>
              <td>{item.serialNumber || '-'}</td>
              <td>{item.manufactureDate ? formatDate(item.manufactureDate) : '-'}</td>
              <td>{item.quantity || 1}</td>
              <td>{item.warrantyPeriod || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenUpdatePagePanel({ task }: { task: EngineerTask }) {
  return (
    <section className="rounded-[16px] border border-[#dbeafe] bg-[#eff6ff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#1d4ed8]">Cập nhật phiếu</span>
          <h3 className="mt-1 text-base font-bold text-[#172554]">Cập nhật phiếu</h3>
        </div>
        <Link className="task-action" to={taskUpdateHref(task)}>
          Mở trang cập nhật
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
