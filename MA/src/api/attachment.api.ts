import { apiClient } from './client';

export type WorkAttachment = {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
  title?: string | null;
  description?: string | null;
  uploadedById?: string;
};

export type LocalPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export const attachmentApi = {
  async list(entityId: string, entityType = 'Repair') {
    const { data } = await apiClient.get<{ data: WorkAttachment[] }>('/attachments', {
      params: { entityType, entityId, limit: 100 },
    });
    return data.data || [];
  },
  async upload(entityId: string, photo: LocalPhoto, entityType = 'Repair') {
    const form = new FormData();
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    form.append('type', 'ERROR_PHOTO');
    form.append('title', photo.fileName || 'Ảnh hiện trường');
    form.append('file', {
      uri: photo.uri,
      name: photo.fileName || `repair-${Date.now()}.jpg`,
      type: photo.mimeType || 'image/jpeg',
    } as unknown as Blob);
    const { data } = await apiClient.post<WorkAttachment>('/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async remove(id: string) {
    return (await apiClient.delete(`/attachments/${id}`)).data;
  },
};
