import { create, isAxiosError } from 'axios';
import { readToken } from '@/services/token-storage';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || 'http://localhost:3000/api').replace(/\/$/, '');

export const apiClient = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      const { clearToken } = await import('@/services/token-storage');
      await clearToken();
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (!error.response) return `Không kết nối được API tại ${API_BASE_URL}. Kiểm tra BE, Wi-Fi và địa chỉ IP.`;
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join('\n') : message || error.message;
  }
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}
