import { Download, Eye, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  onDelete: (attachment: TaskAttachment) => Promise<void>;
  onFilesChange: (files: File[]) => void;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: AttachmentType) => void;
  onUpload: () => void;
  onView: (attachment: TaskAttachment) => Promise<string | null>;
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
  onDelete,
  onFilesChange,
  onTitleChange,
  onTypeChange,
  onUpload,
  onView,
  options,
  titlePlaceholder,
  uploading,
}: WorkAttachmentsPanelProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [pendingPreview, setPendingPreview] = useState('');
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls = attachmentFiles.filter((file) => file.type.startsWith('image/')).map((file) => URL.createObjectURL(file));
    setPendingPreview(urls[0] || '');
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [attachmentFiles]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void Promise.all(attachments.filter((item) => item.mimeType.startsWith('image/')).map(async (item) => {
      const url = await onView(item);
      if (url) urls.push(url);
      return [item.id, url] as const;
    })).then((entries) => {
      if (cancelled) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setAttachmentPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  async function previewAttachment(attachment: TaskAttachment) {
    if (!attachment.mimeType.startsWith('image/')) {
      await onView(attachment);
      return;
    }
    const url = await onView(attachment);
    if (url) {
      setPreviewName(attachment.title || attachment.originalName);
      setPreviewUrl(url);
    }
  }

  function closePreview() {
    if (previewUrl && previewUrl !== pendingPreview && !Object.values(attachmentPreviewUrls).includes(previewUrl)) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setPreviewName('');
  }

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
              <article className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3" key={attachment.id}>
                {attachment.mimeType.startsWith('image/') ? (
                  <button className="h-12 w-12 overflow-hidden rounded-lg bg-[#eef0f3]" onClick={() => void previewAttachment(attachment)} title="Xem ảnh" type="button">
                    {attachmentPreviewUrls[attachment.id] ? <img alt={attachment.title || attachment.originalName} className="h-full w-full object-cover" src={attachmentPreviewUrls[attachment.id]} /> : <span className="grid h-full place-items-center text-xs text-[#667085]">Ảnh</span>}
                  </button>
                ) : <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#eef0f3] text-xs font-bold text-[#667085]">PDF</span>}
                <div className="min-w-0">
                  <span className="text-xs font-medium text-[#666666]">{attachmentTypeLabel(attachment.type)}</span>
                  <strong className="mt-1 block truncate text-sm text-[#1f1f1f]">{attachment.title || attachment.originalName}</strong>
                  <small className="block truncate text-xs text-[#666666]">
                    {attachment.originalName} - {formatFileSize(attachment.size)}
                  </small>
                </div>
                <div className="flex gap-2">
                  <button className="icon-button" onClick={() => void previewAttachment(attachment)} title="Xem" type="button">
                    <Eye size={16} />
                  </button>
                  <button className="icon-button" onClick={() => onDownload(attachment)} title="Download" type="button">
                    <Download size={16} />
                  </button>
                  <button className="icon-button danger" onClick={() => void onDelete(attachment)} title="Xóa ảnh/tài liệu" type="button"><X size={16} /></button>
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
          {attachmentFiles.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {pendingPreview ? <button className="h-14 w-14 overflow-hidden rounded-lg border border-[#ded8d8]" onClick={() => { setPreviewName('Ảnh đang chọn'); setPreviewUrl(pendingPreview); }} title="Xem ảnh đang chọn" type="button"><img alt="Ảnh đang chọn" className="h-full w-full object-cover" src={pendingPreview} /></button> : null}
              <span className="text-xs font-semibold text-[#666666]">Đã chọn {attachmentFiles.length} file</span>
              {attachmentFiles.map((file, index) => <button className="text-xs font-semibold text-[#b42318] underline" key={`${file.name}-${index}`} onClick={() => onFilesChange(attachmentFiles.filter((_, fileIndex) => fileIndex !== index))} type="button">Bỏ {file.name}</button>)}
            </div>
          ) : null}
        </label>
        <button className="primary-button" disabled={uploading || !attachmentFiles.length} onClick={() => void onUpload()} type="button">
          {uploading ? <Loader2 className="spin-icon" size={17} /> : null}
          {uploading ? 'Đang tải lên' : `Tải lên ${attachmentFiles.length || ''} file`}
        </button>
      </div>

      {previewUrl ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4" onClick={closePreview} role="presentation">
          <section aria-label={previewName || 'Xem ảnh'} aria-modal="true" className="relative grid max-h-[92vh] w-full max-w-5xl place-items-center rounded-2xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="Đóng ảnh" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white" onClick={closePreview} type="button"><X size={20} /></button>
            <img alt={previewName} className="max-h-[84vh] max-w-full object-contain" src={previewUrl} />
            <p className="mt-2 max-w-full truncate text-sm font-medium text-[#344054]">{previewName}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
