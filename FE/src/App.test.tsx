import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import App from './App';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('./layouts/AppShell', () => ({
  AppShell: () => <div>App shell rendered</div>,
}));

vi.mock('./lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => <div>Login page rendered</div>,
}));

describe('App session rehydration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
    } as ReturnType<typeof useQuery>);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders from the stored user while session validation runs in the background', () => {
    localStorage.setItem('vietmed_access_token', 'cached-token');
    localStorage.setItem(
      'vietmed_current_user',
      JSON.stringify({
        id: 'user-1',
        email: 'user@example.test',
        role: { id: 'role-1', name: 'admin' },
      }),
    );

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('App shell rendered')).toBeInTheDocument();
    expect(screen.queryByText('Đang kiểm tra phiên làm việc')).toBeNull();
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['auth', 'me'],
        enabled: true,
      }),
    );
  });
});
