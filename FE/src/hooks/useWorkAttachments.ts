import { useState } from 'react';
import { Paginated, apiFetch, getApiBaseUrl, getToken } from '../api';
import type { AttachmentType, TaskAttachment } from '../pages/EngineerTasksPage/types';

type UseWorkAttachmentsOptions = {
  entityId: string;
  entityType: string;
  initialType: AttachmentType;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  uploadSuccessMessage: (count: number) => string;
};

export function useWorkAttachments({
  entityId,
  entityType,
  initialType,
  onError,
  onSuccess,
  uploadSuccessMessage,
}: UseWorkAttachmentsOptions) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>(initialType);
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  async function loadAttachments() {
    if (!entityId) return;

    setLoadingAttachments(true);

    try {
      const response = await apiFetch<Paginated<TaskAttachment>>(
        `/attachments?entityType=${entityType}&entityId=${entityId}&limit=100`,
      );
      setAttachments(response.data);
    } catch {
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  }

  async function uploadAttachment() {
    if (!attachmentFiles.length) return;

    setUploadingAttachment(true);
    onError('');
    onSuccess('');

    try {
      for (const file of attachmentFiles) {
        const body = new FormData();
        body.append('entityType', entityType);
        body.append('entityId', entityId);
        body.append('type', attachmentType);
        if (attachmentTitle.trim()) {
          body.append('title', attachmentFiles.length > 1 ? `${attachmentTitle.trim()} - ${file.name}` : attachmentTitle.trim());
        }
        if (attachmentDescription.trim()) body.append('description', attachmentDescription.trim());
        body.append('file', file);

        await apiFetch('/attachments', {
          method: 'POST',
          body,
        });
      }
      setAttachmentTitle('');
      setAttachmentDescription('');
      setAttachmentFiles([]);
      onSuccess(uploadSuccessMessage(attachmentFiles.length));
      await loadAttachments();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không tải được ảnh/tài liệu.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function downloadAttachment(attachment: TaskAttachment) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      onError('Không tải được tệp đính kèm.');
    }
  }

  async function viewAttachment(attachment: TaskAttachment) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      onError('Không mở được tệp đính kèm.');
    }
  }

  return {
    attachmentDescription,
    attachmentFiles,
    attachmentTitle,
    attachmentType,
    attachments,
    downloadAttachment,
    loadAttachments,
    loadingAttachments,
    setAttachmentDescription,
    setAttachmentFiles,
    setAttachmentTitle,
    setAttachmentType,
    uploadAttachment,
    uploadingAttachment,
    viewAttachment,
  };
}
