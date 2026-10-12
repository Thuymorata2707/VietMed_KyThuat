import { ArrowRight, ClipboardCheck, MapPin, PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EngineerTask } from '../types';
import {
  statusLabel,
  statusTone,
  taskAttention,
  taskContactPhone,
  taskCustomer,
  taskDate,
  taskIcon,
  taskKindLabel,
  taskLocation,
  taskModelText,
  taskSerialText,
  taskTitle,
  taskUpdateHref,
} from '../utils';

type EngineerTaskRowProps = {
  onOpen: (task: EngineerTask) => void;
  task: EngineerTask;
};

export function EngineerTaskRow({ onOpen, task }: EngineerTaskRowProps) {
  const actionHref = taskUpdateHref(task);
  const attention = taskAttention(task);
  const machine = task.machine?.machineCode || task.machine?.serialNumber || taskSerialText(task) || 'Chưa có mã máy';
  const model = task.machine?.modelName || taskModelText(task) || 'Chưa có model';
  const customer = taskCustomer(task) || 'Chưa có khách hàng';
  const phone = taskContactPhone(task);
  const location = taskLocation(task);
  const directionsHref = location
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
    : '';

  return (
    <article className={`engineer-task-row ${attention.tone}`}>
      <div className="engineer-task-row__head">
        <div className="engineer-task-row__icon">{taskIcon(task.kind)}</div>
        <div className="engineer-task-row__title">
          <div className="engineer-task-row__meta">
            <span>{taskKindLabel(task.kind)}</span>
            <span>{taskDate(task)}</span>
          </div>
          <h2>{taskTitle(task)}</h2>
          <span className="engineer-task-row__code">{task.code}</span>
        </div>
      </div>

      <div className="engineer-task-row__body">
        <div className="engineer-task-row__facts">
          <span className="strong">{customer}</span>
          <span>{model}</span>
          <span>{machine}</span>
        </div>
        {location ? <span className="engineer-task-row__location">{location}</span> : null}
      </div>

      <div className="engineer-task-row__status">
        <span className={`task-badge ${statusTone(task.status)}`}>{task.kind === 'installation' ? installationProgressLabel(task) : statusLabel(task.status)}</span>
        <span className={`engineer-next-step ${attention.tone}`}>{attention.label}</span>
      </div>

      <div className="engineer-task-row__action">
        <div className="engineer-task-row__buttons">
          {phone ? (
            <a className="task-secondary icon-button" href={`tel:${phone}`} title={`Gọi ${phone}`}>
              <PhoneCall size={15} />
            </a>
          ) : null}
          {directionsHref ? (
            <a className="task-secondary icon-button" href={directionsHref} rel="noreferrer" target="_blank" title="Chỉ đường">
              <MapPin size={15} />
            </a>
          ) : null}
          <button className="task-secondary" onClick={() => onOpen(task)} type="button">
            <ClipboardCheck size={15} />
            Chi tiết
          </button>
          {actionHref ? (
            <Link className="task-action" to={actionHref}>
              Cập nhật
              <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function installationProgressLabel(task: Extract<EngineerTask, { kind: 'installation' }>) {
  const items = task.installedDeviceItems || [];
  const primaryItem = items.find((item) => item.isPrimary);
  const hasPrimary = Boolean(task.machine || task.plannedMachineModelId || task.plannedModelName || primaryItem);
  const extraItems = items.filter((item) => !item.isPrimary && item.itemName?.trim());
  const extraCount = extraItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  const total = (hasPrimary ? 1 : 0) + extraCount;
  if (!total) return 'Chờ khảo sát';
  const installed = task.status === 'INSTALLED'
    ? total
    : (hasPrimary && primaryItem?.isInstalled ? 1 : 0) + extraItems
        .filter((item) => item.isInstalled)
        .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  if (task.status === 'INSTALLED') return `Đã lắp ${installed}/${total}`;
  if (installed === 0) return `Chờ triển khai · 0/${total}`;
  return `Đang lắp ${installed}/${total}`;
}
