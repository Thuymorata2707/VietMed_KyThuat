import { ArrowRight, ClipboardCheck, MapPin, PhoneCall } from 'lucide-react';
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
} from '../utils';

type EngineerTaskRowProps = {
  onOpen: (task: EngineerTask) => void;
  task: EngineerTask;
};

export function EngineerTaskRow({ onOpen, task }: EngineerTaskRowProps) {
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
        <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
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
          <button className="task-action" onClick={() => onOpen(task)} type="button">
            Cập nhật
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
