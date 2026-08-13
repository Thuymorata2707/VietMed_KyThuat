import { Download, Eye, Loader2 } from 'lucide-react';
import type { AttachmentType, TaskAttachment } from '../../pages/EngineerTasksPage/types';
import { attachmentTypeLabel, formatFileSize } from '../../pages/EngineerTasksPage/utils';

type AttachmentOption = {
  label: string;
  value: AttachmentType;
};

type WorkAttachmentsPanelProps = {
  attachmentDescription: string;
  attachmentFiles: File[];
  attachmentTitle: string;
  attachmentType: AttachmentType;
  attachments: TaskAttachment[];
  descriptionClassName: string;
  fieldClassName: string;
  labelClassName: string;
  loading: boolean;
  onDescriptionChange: (value: string) => void;
  onDownload: (attachment: TaskAttachment) => void;
  onFilesChange: (files: File[]) => void;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: AttachmentType) => void;
  onUpload: () => void;
  onView: (attachment: TaskAttachment) => void;
  options: AttachmentOption[];
  titlePlaceholder: string;
  uploading: boolean;
};

const sidePanelClass = 'rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]';
const sectionTitleClass = 'mt-1 text-lg font-bold leading-tight text-[#1f1f1f]';

export function WorkAttachmentsPanel({
  attachmentDescription,
  attachmentFiles,
  attachmentTitle,
  attachmentType,
  attachments,
  descriptionClassName,
  fieldClassName,
  labelClassName,
  loading,
  onDescriptionChange,
  onDownload,
  onFilesChange,
  onTitleChange,
  onTypeChange,
  onUpload,
  onView,
  options,
  titlePlaceholder,
  uploading,
}: WorkAttachmentsPanelProps) {
  return (
    <section className={sidePanelClass}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#f0e6e6] pb-4">
        <div>
          <span className={eyebrowClass}>Tài liệu hiện trường</span>
          <h2 className={sectionTitleClass}>Ảnh và biên bản</h2>
        </div>
        <strong className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 text-sm text-[#333333]">{attachments.length}</strong>
      </div>

      <div className="grid gap-2">
        {loading ? (
          <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-[#666666]">
            <Loader2 className="spin-icon" size={16} />
            Đang tải tài liệu...
          </div>
        ) : null}

        {!loading && attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-[#fafafa] p-4 text-center text-sm text-[#666666]">
            Chưa có ảnh hoặc tài liệu nào cho phiếu này.
          </div>
        ) : null}

        {!loading
          ? attachments.map((attachment) => (
              <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3" key={attachment.id}>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-[#666666]">{attachmentTypeLabel(attachment.type)}</span>
                  <strong className="mt-1 block truncate text-sm text-[#1f1f1f]">{attachment.title || attachment.originalName}</strong>
                  <small className="block truncate text-xs text-[#666666]">
                    {attachment.originalName} - {formatFileSize(attachment.size)}
                  </small>
                </div>
                <div className="flex gap-2">
                  <button className="icon-button" onClick={() => void onView(attachment)} title="Xem" type="button">
                    <Eye size={16} />
                  </button>
                  <button className="icon-button" onClick={() => onDownload(attachment)} title="Download" type="button">
                    <Download size={16} />
                  </button>
                </div>
              </article>
            ))
          : null}
      </div>

      <div className="mt-4 grid min-w-0 gap-3 border-t border-[#eeeeee] pt-4">
        <label className={labelClassName}>
          Loại tài liệu
          <select className={fieldClassName} onChange={(event) => onTypeChange(event.target.value as AttachmentType)} value={attachmentType}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Tên hiển thị
          <input className={fieldClassName} onChange={(event) => onTitleChange(event.target.value)} placeholder={titlePlaceholder} value={attachmentTitle} />
        </label>
        <label className={labelClassName}>
          Ghi chú
          <textarea className={`${descriptionClassName} min-h-24`} onChange={(event) => onDescriptionChange(event.target.value)} value={attachmentDescription} />
        </label>
        <label className={labelClassName}>
          File
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="w-full min-w-0 rounded-2xl border border-dashed border-[#ded8d8] bg-[#ffffff] px-4 py-3 text-sm font-semibold text-[#333333]"
            multiple
            onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
            type="file"
          />
          {attachmentFiles.length ? <span className="text-xs font-semibold text-[#666666]">Đã chọn {attachmentFiles.length} file</span> : null}
        </label>
        <button className="primary-button" disabled={uploading || !attachmentFiles.length} onClick={() => void onUpload()} type="button">
          {uploading ? <Loader2 className="spin-icon" size={17} /> : null}
          {uploading ? 'Đang tải lên' : `Tải lên ${attachmentFiles.length || ''} file`}
        </button>
      </div>
    </section>
  );
}
