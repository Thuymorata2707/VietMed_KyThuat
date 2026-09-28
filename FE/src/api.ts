const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'vietmed_access_token';
const USER_KEY = 'vietmed_current_user';

export type ApiUser = {
  id: string;
  email: string;
  username?: string | null;
  fullName?: string;
  phone?: string | null;
  status?: string;
  role?: { id: string; name: string };
  region?: { id: string; name: string; code: string };
  engineerProfile?: {
    employeeCode?: string | null;
    dateOfBirth?: string | null;
    position?: string | null;
    department?: string | null;
    workStartDate?: string | null;
    specialties?: string[];
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    expertiseGroups?: Array<'IMAGING' | 'LAB_TESTING'>;
    certificateNo?: string | null;
    photoUrl?: string | null;
    note?: string | null;
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

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  void fetch(`${API_BASE_URL}/auth/logout`, {
    credentials: 'include',
    headers: { 'X-CSRF-Protection': '1' },
    method: 'POST',
  }).catch(() => null);
}

export function getStoredUser(): ApiUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: ApiUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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

  if (isUnsafeMethod(options.method)) {
    headers.set('X-CSRF-Protection', '1');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? 'include',
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
    throw new ApiRequestError(toVietnameseApiError(message, response.status), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function apiFetchAllPages<T>(path: string, pageSize = 100): Promise<T[]> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const firstPath = withPagination(path, 1, safePageSize);
  const firstPage = await apiFetch<Paginated<T> | T[]>(firstPath);
  const getRows = (result: Paginated<T> | T[]) =>
    Array.isArray(result) ? result : result?.data ?? [];
  const pages = [getRows(firstPage)];
  const totalPages = Array.isArray(firstPage)
    ? 1
    : Math.max(1, firstPage?.meta?.totalPages ?? 1);

  const maxParallelRequests = 5;
  for (let firstPageNumber = 2; firstPageNumber <= totalPages; firstPageNumber += maxParallelRequests) {
    const pageNumbers = Array.from(
      { length: Math.min(maxParallelRequests, totalPages - firstPageNumber + 1) },
      (_unused, index) => firstPageNumber + index,
    );
    const nextPages = await Promise.all(
      pageNumbers.map((page) =>
        apiFetch<Paginated<T> | T[]>(withPagination(path, page, safePageSize)),
      ),
    );
    pages.push(...nextPages.map(getRows));
  }

  return pages.flat();
}

export async function login(identifier: string, password: string) {
  const result = await apiFetch<{ accessToken?: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  localStorage.removeItem(TOKEN_KEY);
  setStoredUser(result.user);
  return result.user;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function withPagination(path: string, page: number, limit: number) {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return `${pathname}?${params.toString()}`;
}

function isUnsafeMethod(method?: string) {
  const normalized = (method || 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}

function toVietnameseApiError(message: string, statusCode: number) {
  const normalized = message.toLowerCase();

  if (statusCode === 429 && normalized.includes('failed login attempts')) {
    return 'Đăng nhập đang tạm khóa do nhập sai nhiều lần. Vui lòng chờ khoảng 15 phút rồi thử lại.';
  }
  if (statusCode === 429) {
    return 'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.';
  }
  if (normalized.includes('email already exists')) return 'Email đã tồn tại trong hệ thống.';
  if (normalized.includes('username already exists')) return 'Tên đăng nhập đã tồn tại trong hệ thống.';
  if (normalized.includes('code already exists') || normalized.includes('already exists')) return 'Mã hoặc dữ liệu này đã tồn tại.';
  if (normalized.includes('password must be at least')) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (normalized.includes('role does not exist')) return 'Vai trò không tồn tại.';
  if (normalized.includes('region does not exist')) return 'Khu vực không tồn tại.';
  if (normalized.includes('engineer does not exist')) return 'Kỹ sư phụ trách không tồn tại hoặc chưa hoạt động.';
  if (normalized.includes('not found')) return 'Không tìm thấy dữ liệu cần thao tác.';
  if (normalized.includes('limit must not be greater than')) return 'Số mục tải lên không được vượt quá giới hạn backend cho phép.';
  if (normalized.includes('unauthorized') || statusCode === 401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.';
  if (normalized.includes('forbidden') || statusCode === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (statusCode === 409) return 'Dữ liệu bị trùng, vui lòng kiểm tra lại mã hoặc email.';
  if (statusCode >= 500) return 'Backend đang gặp lỗi, vui lòng thử lại sau.';

  return message || 'Không thể kết nối API';
}
