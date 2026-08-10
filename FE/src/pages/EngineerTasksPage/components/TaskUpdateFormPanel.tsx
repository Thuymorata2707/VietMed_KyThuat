import type { FormEvent } from 'react';
import type { ApiUser } from '../../../api';
import { DateInput } from '../../../components/DateInput';
import { InstallationHandoverForm } from '../InstallationHandoverForm';
import { drawerFieldClass, drawerTextareaClass } from '../constants';
import type { CreateTicketForm, EngineerTask, InstallationDeviceItem, QuickMachineModel } from '../types';
import { statusLabel, taskUpdatePanelTitle } from '../utils';
import { StatusActionPicker } from './EngineerTaskPanels';

type TaskUpdateFormPanelProps = {
  completionBlockers: string[];
  customerFeedback: string;
  installationDate: string;
  installationEditForm: CreateTicketForm;
  machineModelOptions: QuickMachineModel[];
  nextDueDate: string;
  resultNote: string;
  saving: boolean;
  status: string;
  task: EngineerTask;
  user: ApiUser;
  addInstallationEditDeviceItem: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  removeInstallationEditDeviceItem: (index: number) => void;
  setCustomerFeedback: (value: string) => void;
  setInstallationDate: (value: string) => void;
  setNextDueDate: (value: string) => void;
  setResultNote: (value: string) => void;
  setStatus: (value: string) => void;
  updateInstallationEditDeviceItem: (index: number, patch: Partial<InstallationDeviceItem>) => void;
  updateInstallationEditForm: (patch: Partial<CreateTicketForm>) => void;
};

export function TaskUpdateFormPanel({
  completionBlockers,
  customerFeedback,
  installationDate,
  installationEditForm,
  machineModelOptions,
  nextDueDate,
  resultNote,
  saving,
  status,
  task,
  user,
  addInstallationEditDeviceItem,
  onClose,
  onSubmit,
  removeInstallationEditDeviceItem,
  setCustomerFeedback,
  setInstallationDate,
  setNextDueDate,
  setResultNote,
  setStatus,
  updateInstallationEditDeviceItem,
  updateInstallationEditForm,
}: TaskUpdateFormPanelProps) {
  return task.kind === 'installation' ? (
    <section className="mt-5 grid gap-3.5 rounded-[18px] border border-[#e4e4e7] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <UpdatePanelHeading task={task} />
      <form className="grid content-start gap-3.5" onSubmit={onSubmit}>
        <StatusActionPicker onChange={setStatus} task={task} value={status} />
        <DateInput className={drawerFieldClass} label="Ngày lắp đặt" onChange={setInstallationDate} value={installationDate} />
        <label className={drawerFieldClass}>
          Ghi chú lắp đặt
          <textarea className={drawerTextareaClass} onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
        </label>
        <DateInput className={drawerFieldClass} label="Kết thúc bảo hành" onChange={(value) => updateInstallationEditForm({ warrantyEndDate: value })} required value={installationEditForm.warrantyEndDate} />
        <label className={`create-wide-field ${drawerFieldClass}`}>
          Ghi chú bảo hành
          <textarea
            className={drawerTextareaClass}
            onChange={(event) => updateInstallationEditForm({ description: event.target.value })}
            value={installationEditForm.description}
          />
        </label>
        <InstallationHandoverForm
          addDeviceItem={addInstallationEditDeviceItem}
          form={installationEditForm}
          machineModels={machineModelOptions}
          removeDeviceItem={removeInstallationEditDeviceItem}
          updateDeviceItem={updateInstallationEditDeviceItem}
          updateForm={updateInstallationEditForm}
          user={user}
        />
        <UpdateFormActions completionBlockers={completionBlockers} onClose={onClose} saving={saving} status={status} />
      </form>
    </section>
  ) : (
    <section className="mt-5 grid gap-3.5 rounded-[18px] border border-[#e4e4e7] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <UpdatePanelHeading task={task} />
      <form className="grid grid-cols-2 content-start gap-3.5 max-[760px]:grid-cols-1" onSubmit={onSubmit}>
        <StatusActionPicker onChange={setStatus} task={task} value={status} />
        <label className={`col-span-full ${drawerFieldClass}`}>
          Kết quả/Ghi chú kỹ thuật
          <textarea className={drawerTextareaClass} onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
        </label>
        {task.kind === 'repair' ? (
          <label className={`col-span-full ${drawerFieldClass}`}>
            Phản hồi khách hàng
            <textarea className={drawerTextareaClass} onChange={(event) => setCustomerFeedback(event.target.value)} value={customerFeedback} />
          </label>
        ) : (
          <DateInput className={drawerFieldClass} label="Lịch bảo trì tiếp theo" onChange={setNextDueDate} value={nextDueDate} />
        )}
        <UpdateFormActions completionBlockers={completionBlockers} onClose={onClose} saving={saving} status={status} />
      </form>
    </section>
  );
}

function UpdatePanelHeading({ task }: { task: EngineerTask }) {
  return (
    <div className="flex items-start justify-between max-[760px]:flex-col max-[760px]:gap-2.5">
      <div>
        <span className="text-[12px] font-bold text-[#18181b]">Kỹ sư cập nhật</span>
        <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">{taskUpdatePanelTitle(task)}</h3>
      </div>
    </div>
  );
}

function UpdateFormActions({
  completionBlockers,
  onClose,
  saving,
  status,
}: {
  completionBlockers: string[];
  onClose: () => void;
  saving: boolean;
  status: string;
}) {
  return (
    <>
      <div className="col-span-full mt-2 flex justify-end gap-2.5">
        <button className="task-secondary" onClick={onClose} type="button">
          Đóng
        </button>
        <button className="task-primary" disabled={saving || completionBlockers.length > 0} type="submit">
          {saving ? 'Đang lưu' : 'Lưu cập nhật'}
        </button>
      </div>
      {completionBlockers.length ? (
        <div className="field-completion-warning col-span-full" role="status">
          <strong>Chưa thể hoàn tất phiếu</strong>
          <span>Bổ sung {completionBlockers.join(', ')} trước khi lưu trạng thái {statusLabel(status).toLowerCase()}.</span>
        </div>
      ) : null}
    </>
  );
}
