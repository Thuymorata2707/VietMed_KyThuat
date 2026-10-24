import { apiClient } from './client';

export type AppUser = {
  id: string; fullName?: string; email: string; username?: string; phone?: string | null; status?: string;
  role?: { name?: string }; region?: { name?: string; code?: string } | null;
  engineerProfile?: { employeeCode?: string | null; dateOfBirth?: string | null; position?: string | null; department?: string | null; workStartDate?: string | null; specialties?: string[]; expertiseGroup?: string | null; expertiseGroups?: string[]; certificateNo?: string | null; photoUrl?: string | null; note?: string | null } | null;
};

export const authApi = {
  async login(identifier: string, password: string) {
    const { data } = await apiClient.post<{ user: AppUser; access_token: string }>('/auth/mobile-login', { identifier, password });
    return data;
  },
  async me() {
    const { data } = await apiClient.get<AppUser>('/auth/me');
    return data;
  },
  async updateMe(payload: Record<string, unknown>) { return (await apiClient.patch<AppUser>('/auth/me', payload)).data; },
  async uploadProfilePhoto(userId: string, asset: { uri: string; fileName?: string | null; mimeType?: string | null }) {
    const form = new FormData();
    form.append('entityType', 'User'); form.append('entityId', userId); form.append('title', 'Ảnh đại diện'); form.append('type', 'OTHER');
    form.append('file', { uri: asset.uri, name: asset.fileName || 'profile.jpg', type: asset.mimeType || 'image/jpeg' } as unknown as Blob);
    const { data } = await apiClient.post<{ url: string }>('/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
};
