import { ArrowRight } from 'lucide-react';
import type { EngineerTask } from '../types';
import {
  reviewStatusLabel,
  reviewStatusTone,
  secondaryLabel,
  secondaryTone,
  statusLabel,
  statusTone,
  taskAttention,
  taskCustomer,
  taskDate,
  taskDescription,
  taskIcon,
  taskKindLabel,
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

  return (
    <article className={`engineer-task-row ${attention.tone}`}>
      <div className="engineer-task-row__head">
        <div className="engineer-task-row__icon">{taskIcon(task.kind)}</div>
        <div className="engineer-task-row__title">
          <div className="engineer-task-row__meta">
            <span>{taskKindLabel(task.kind)}</span>
            <span>{task.code}</span>
            <span>{taskDate(task)}</span>
          </div>
          <h2>{taskTitle(task)}</h2>
        </div>
      </div>

      <div className="engineer-task-row__body">
        <p>{taskDescription(task) || 'Chưa có mô tả chi tiết.'}</p>
        <div className="engineer-task-row__facts">
          <span>{machine}</span>
          <span>{model}</span>
          <span>{customer}</span>
        </div>
      </div>

      <div className="engineer-task-row__status">
        <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
        {task.reviewStatus && task.reviewStatus !== 'NOT_REQUIRED' ? (
          <span className={`task-badge ${reviewStatusTone(task.reviewStatus)}`}>{reviewStatusLabel(task.reviewStatus)}</span>
        ) : null}
        <span className={`task-badge ${secondaryTone(task)}`}>{secondaryLabel(task)}</span>
      </div>

      <div className="engineer-task-row__action">
        <span className={`engineer-next-step ${attention.tone}`}>{attention.label}</span>
        <button className="task-action" onClick={() => onOpen(task)} type="button">
          Nhập kết quả
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}
