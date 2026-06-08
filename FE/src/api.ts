const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'vietmed_access_token';

export type ApiUser = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string | null;
  status?: string;
  role?: { id: string; name: string };
  region?: { id: string; name: string; code: string };
  engineerProfile?: {
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
  } | null;
  roleName?: string;
  regionId?: string;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ApiError = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let payload: ApiError = {};
    try {
      payload = await response.json();
    } catch {
      payload = { message: response.statusText };
    }

    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'Không thể kết nối API';
    throw new Error(toVietnameseApiError(message, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const result = await apiFetch<{ accessToken: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.accessToken);
  return result.user;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function toVietnameseApiError(message: string, statusCode: number) {
  const normalized = message.toLowerCase();

  if (normalized.includes('email already exists')) return 'Email đã tồn tại trong hệ thống.';
  if (normalized.includes('code already exists') || normalized.includes('already exists')) return 'Mã hoặc dữ liệu này đã tồn tại.';
  if (normalized.includes('password must be at least')) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (normalized.includes('role does not exist')) return 'Vai trò không tồn tại.';
  if (normalized.includes('region does not exist')) return 'Khu vực không tồn tại.';
  if (normalized.includes('not found')) return 'Không tìm thấy dữ liệu cần thao tác.';
  if (normalized.includes('limit must not be greater than')) return 'Số dòng tải lên không được vượt quá giới hạn backend cho phép.';
  if (normalized.includes('unauthorized') || statusCode === 401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.';
  if (normalized.includes('forbidden') || statusCode === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (statusCode === 409) return 'Dữ liệu bị trùng, vui lòng kiểm tra lại mã hoặc email.';
  if (statusCode >= 500) return 'Backend đang gặp lỗi, vui lòng thử lại sau.';

  return message || 'Không thể kết nối API';
}
