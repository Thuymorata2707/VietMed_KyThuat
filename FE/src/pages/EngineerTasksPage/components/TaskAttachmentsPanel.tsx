import { Download, Eye, FileUp, Loader2 } from 'lucide-react';
import type { AttachmentType, EngineerTask, TaskAttachment } from '../types';
import { attachmentOptionsByKind, drawerFieldClass, drawerInputClass, drawerTextareaClass } from '../constants';
import { attachmentTypeLabel, formatFileSize } from '../utils';

type TaskAttachmentsPanelProps = {
  attachmentDescription: string;
  attachmentFiles: File[];
  attachmentTitle: string;
  attachmentType: AttachmentType;
  attachments: TaskAttachment[];
  fileInputKey: number;
  loadingAttachments: boolean;
  task: EngineerTask;
  uploadingAttachment: boolean;
  onDescriptionChange: (value: string) => void;
  onDownload: (attachment: TaskAttachment) => void;
  onFilesChange: (files: File[]) => void;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: AttachmentType) => void;
  onUpload: () => void;
  onView: (attachment: TaskAttachment) => void;
};

export function TaskAttachmentsPanel({
  attachmentDescription,
  attachmentFiles,
  attachmentTitle,
  attachmentType,
  attachments,
  fileInputKey,
  loadingAttachments,
  task,
  uploadingAttachment,
  onDescriptionChange,
  onDownload,
  onFilesChange,
  onTitleChange,
  onTypeChange,
  onUpload,
  onView,
}: TaskAttachmentsPanelProps) {
  return (
    <section className="mt-[22px] grid gap-3.5 rounded-[18px] border border-[#e4e4e7] bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[12px] font-bold text-[#18181b]">Tài liệu hiện trường</span>
          <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">Ảnh và biên bản</h3>
        </div>
        <strong className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2 text-[#18181b]">{attachments.length}</strong>
      </div>

      <div className="grid gap-2.5">
        {loadingAttachments ? (
          <div className="flex min-h-[58px] items-center gap-2 rounded-lg border border-dashed border-[#d6d6d6] bg-[#fafafa] p-3.5 text-[#666666]">
            <Loader2 className="spin-icon" size={16} />
            Đang tải tài liệu...
          </div>
        ) : null}

        {!loadingAttachments &&
          attachments.map((attachment) => (
            <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3" key={attachment.id}>
              <div className="grid min-w-0 gap-1">
                <span className="text-[12px] font-bold text-[#18181b]">{attachmentTypeLabel(attachment.type)}</span>
                <strong className="text-[#1f1f1f] [overflow-wrap:anywhere]">{attachment.title || attachment.originalName}</strong>
                <small className="text-[#666666] [overflow-wrap:anywhere]">
                  {attachment.originalName} · {formatFileSize(attachment.size)}
                </small>
              </div>
              <div className="flex gap-2">
                <button className="task-secondary icon-button" onClick={() => onView(attachment)} title="Xem" type="button">
                  <Eye size={16} />
                </button>
                <button className="task-secondary icon-button" onClick={() => onDownload(attachment)} title="Tải xuống" type="button">
                  <Download size={16} />
                </button>
              </div>
            </article>
          ))}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-[14px] border border-[#e4e4e7] bg-[#f8fafc] p-3.5 max-[760px]:grid-cols-1">
        <label className={drawerFieldClass}>
          Loại tài liệu
          <select className={drawerInputClass} onChange={(event) => onTypeChange(event.target.value as AttachmentType)} value={attachmentType}>
            {attachmentOptionsByKind[task.kind].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={drawerFieldClass}>
          Tên hiển thị
          <input className={drawerInputClass} onChange={(event) => onTitleChange(event.target.value)} placeholder="VD: Ảnh serial trước sửa chữa" value={attachmentTitle} />
        </label>
        <label className={`col-span-full ${drawerFieldClass}`}>
          Ghi chú
          <textarea className={drawerTextareaClass} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Ghi chú ngắn cho file nếu cần" value={attachmentDescription} />
        </label>
        <label className={`col-span-full ${drawerFieldClass}`}>
          File ảnh/PDF
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className={`${drawerInputClass} flex items-center px-2.5 py-2`}
            key={fileInputKey}
            multiple
            onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
            required
            type="file"
          />
          {attachmentFiles.length ? (
            <span className="text-xs font-semibold text-[#666666]">
              Đã chọn {attachmentFiles.length} file
            </span>
          ) : null}
        </label>
        <button className="task-primary justify-self-end gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={uploadingAttachment || !attachmentFiles.length} onClick={onUpload} type="button">
          <FileUp size={16} />
          {uploadingAttachment ? 'Đang tải lên' : `Tải lên ${attachmentFiles.length || ''} file`}
        </button>
      </div>
    </section>
  );
}
