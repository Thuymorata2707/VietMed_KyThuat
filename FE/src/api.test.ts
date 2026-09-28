import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiFetch, apiFetchAllPages } from './api';

describe('apiFetch rate-limit messages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains that a login lock is temporary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          message: 'Too many failed login attempts. Please try again later.',
        }),
      }),
    );

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      name: 'ApiRequestError',
      statusCode: 429,
      message:
        'Đăng nhập đang tạm khóa do nhập sai nhiều lần. Vui lòng chờ khoảng 15 phút rồi thử lại.',
    } satisfies Partial<ApiRequestError>);
  });

  it('shows a separate message for general request throttling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too many requests. Please try again later.' }),
      }),
    );

    await expect(apiFetch('/machines')).rejects.toMatchObject({
      statusCode: 429,
      message: 'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.',
    });
  });

  it('loads every page in order with a bounded parallel batch', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      const rows = Array.from({ length: 2 }, (_unused, index) => `${page}-${index + 1}`);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: rows,
            meta: { page, limit: 2, total: 6, totalPages: 3 },
          }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetchAllPages<string>('/example?status=active', 2)).resolves.toEqual([
      '1-1',
      '1-2',
      '2-1',
      '2-2',
      '3-1',
      '3-2',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('status'))).toEqual([
      'active',
      'active',
      'active',
    ]);
  });

  it('treats a response without pagination metadata as a single page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: ['one', 'two'] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetchAllPages<string>('/example')).resolves.toEqual(['one', 'two']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a bare array response as a single page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(['one', 'two']),
      } as Response),
    );

    await expect(apiFetchAllPages<string>('/example')).resolves.toEqual(['one', 'two']);
  });
});
