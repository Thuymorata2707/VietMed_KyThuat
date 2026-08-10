import type { FormEvent } from 'react';
import { DateInput } from '../../../components/DateInput';
import type { CreateTicketForm, TaskKind } from '../types';

type QuickWorkLogPanelProps = {
  form: CreateTicketForm;
  saving: boolean;
  onBack: () => void;
  onChange: (patch: Partial<CreateTicketForm>) => void;
  onKindChange: (kind: TaskKind) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const quickKindLabels: Record<TaskKind, string> = {
  repair: 'Sửa chữa',
  maintenance: 'Bảo trì',
  installation: 'Lắp đặt',
};

export function QuickWorkLogPanel({ form, saving, onBack, onChange, onKindChange, onSubmit }: QuickWorkLogPanelProps) {
  return (
    <section className="engineer-create-panel">
      <div className="task-section-heading">
        <div>
          <span>Ghi nhận nhanh</span>
          <h3>Việc phát sinh của kỹ sư</h3>
        </div>
      </div>

      <form className="engineer-create-form" onSubmit={onSubmit}>
        <label className="task-filter-select create-kind-select create-span-6">
          <span>Loại việc</span>
          <select onChange={(event) => onKindChange(event.target.value as TaskKind)} value={form.kind}>
            {Object.entries(quickKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <DateInput label="Ngày thực hiện" onChange={(value) => onChange({ workDate: value })} required value={form.workDate} />

        <label>
          Khách hàng / đơn vị
          <input
            onChange={(event) => onChange({ usingDepartment: event.target.value })}
            placeholder="VD: BV Đa khoa..., Khoa xét nghiệm..."
            value={form.usingDepartment}
          />
        </label>

        <label>
          Máy / model / serial
          <input
            onChange={(event) => onChange({ deviceName: event.target.value })}
            placeholder="Nhập nhanh nếu chưa có hồ sơ máy"
            value={form.deviceName}
          />
        </label>

        <label>
          Người liên hệ / SĐT
          <input
            onChange={(event) => onChange({ contactPhone: event.target.value })}
            placeholder="Tên hoặc số điện thoại"
            value={form.contactPhone}
          />
        </label>

        <label className="create-span-6">
          Tiêu đề ngắn
          <input
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={form.kind === 'repair' ? 'VD: Xử lý lỗi máy tại khoa xét nghiệm' : form.kind === 'maintenance' ? 'VD: Bảo trì phát sinh tại khách hàng' : 'VD: Hỗ trợ/bàn giao lắp đặt phát sinh'}
            required
            value={form.title}
          />
        </label>

        <label className="create-wide-field">
          Nội dung đã làm
          <textarea
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Ghi nhanh việc đã xử lý, hiện trạng, kết quả, tồn đọng nếu có."
            required
            value={form.description}
          />
        </label>

        <label className="create-wide-field">
          Đề xuất / việc cần admin xử lý tiếp
          <textarea
            onChange={(event) => onChange({ repairMethod: event.target.value })}
            placeholder="VD: cần tạo phiếu chính thức, cần gửi linh kiện, cần hẹn onsite..."
            value={form.repairMethod}
          />
        </label>

        <div className="create-wide-field rounded-[18px] border border-[#e4e4e7] bg-[#fafafa] p-3 text-sm font-medium leading-6 text-[#555555]">
          Lưu vào lịch và báo cáo tuần.
        </div>

        <button className="task-primary create-submit" disabled={saving} type="submit">
          {saving ? 'Đang lưu' : 'Lưu ghi nhận nhanh'}
        </button>
        <button className="task-secondary create-cancel" onClick={onBack} type="button">
          Back
        </button>
      </form>
    </section>
  );
}
