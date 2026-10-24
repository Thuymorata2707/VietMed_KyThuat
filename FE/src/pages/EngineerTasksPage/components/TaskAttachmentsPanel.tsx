import { Download, Eye, FileUp, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  onDelete: (attachment: TaskAttachment) => void;
  onFilesChange: (files: File[]) => void;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: AttachmentType) => void;
  onUpload: () => void;
  onView: (attachment: TaskAttachment) => Promise<string | null>;
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
  onDelete,
  onFilesChange,
  onTitleChange,
  onTypeChange,
  onUpload,
  onView,
}: TaskAttachmentsPanelProps) {
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls = attachmentFiles.filter((file) => file.type.startsWith('image/')).map((file) => URL.createObjectURL(file));
    setFilePreview(urls[0] || '');
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
      if (cancelled) urls.forEach((url) => URL.revokeObjectURL(url));
      else setThumbs(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [attachments]);

  function openPreview(name: string, url: string) { setPreview({ name, url }); }
  function closePreview() {
    if (preview?.url && preview.url !== filePreview && !Object.values(thumbs).includes(preview.url)) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

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
            <article className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3" key={attachment.id}>
              {attachment.mimeType.startsWith('image/') ? <button className="h-12 w-12 overflow-hidden rounded-lg bg-[#eef0f3]" onClick={() => { const url = thumbs[attachment.id]; if (url) openPreview(attachment.title || attachment.originalName, url); }} title="Xem ảnh" type="button">{thumbs[attachment.id] ? <img alt={attachment.title || attachment.originalName} className="h-full w-full object-cover" src={thumbs[attachment.id]} /> : null}</button> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#eef0f3] text-xs">PDF</span>}
              <div className="grid min-w-0 gap-1">
                <span className="text-[12px] font-bold text-[#18181b]">{attachmentTypeLabel(attachment.type)}</span>
                <strong className="text-[#1f1f1f] [overflow-wrap:anywhere]">{attachment.title || attachment.originalName}</strong>
                <small className="text-[#666666] [overflow-wrap:anywhere]">
                  {attachment.originalName} · {formatFileSize(attachment.size)}
                </small>
              </div>
              <div className="flex gap-2">
                <button className="task-secondary icon-button" onClick={() => void onView(attachment).then((url) => { if (url) openPreview(attachment.title || attachment.originalName, url); })} title="Xem" type="button">
                  <Eye size={16} />
                </button>
                <button className="task-secondary icon-button" onClick={() => onDownload(attachment)} title="Tải xuống" type="button">
                  <Download size={16} />
                </button>
                <button className="task-secondary icon-button" onClick={() => onDelete(attachment)} title="Xóa tài liệu" type="button"><X size={16} /></button>
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
          <input className={drawerInputClass} onChange={(event) => onTitleChange(event.target.value)} value={attachmentTitle} />
        </label>
        <label className={`col-span-full ${drawerFieldClass}`}>
          Ghi chú
          <textarea className={drawerTextareaClass} onChange={(event) => onDescriptionChange(event.target.value)} value={attachmentDescription} />
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
            <div className="flex flex-wrap items-center gap-2">
              {filePreview ? <button className="h-14 w-14 overflow-hidden rounded-lg border border-[#ded8d8]" onClick={() => openPreview('Ảnh đang chọn', filePreview)} title="Xem ảnh đang chọn" type="button"><img alt="Ảnh đang chọn" className="h-full w-full object-cover" src={filePreview} /></button> : null}
              <span className="text-xs font-semibold text-[#666666]">Đã chọn {attachmentFiles.length} file</span>
              {attachmentFiles.map((file, index) => <button className="text-xs font-semibold text-[#b42318] underline" key={`${file.name}-${index}`} onClick={() => onFilesChange(attachmentFiles.filter((_, fileIndex) => fileIndex !== index))} type="button">Bỏ {file.name}</button>)}
            </div>
          ) : null}
        </label>
        <button className="task-primary justify-self-end gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={uploadingAttachment || !attachmentFiles.length} onClick={onUpload} type="button">
          <FileUp size={16} />
          {uploadingAttachment ? 'Đang tải lên' : `Tải lên ${attachmentFiles.length || ''} file`}
        </button>
      </div>
      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4" onClick={closePreview} role="presentation"><section aria-label={preview.name} aria-modal="true" className="relative grid max-h-[92vh] w-full max-w-5xl place-items-center rounded-2xl bg-white p-3" onClick={(event) => event.stopPropagation()} role="dialog"><button aria-label="Đóng ảnh" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white" onClick={closePreview} type="button"><X size={20} /></button><img alt={preview.name} className="max-h-[84vh] max-w-full object-contain" src={preview.url} /><p className="mt-2 max-w-full truncate text-sm">{preview.name}</p></section></div> : null}
    </section>
  );
}
