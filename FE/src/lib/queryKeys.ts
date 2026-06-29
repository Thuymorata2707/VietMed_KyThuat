export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  dashboard: {
    overview: ['dashboard', 'overview'] as const,
  },
  reports: {
    installations: (params: string) => ['reports', 'installations', params] as const,
  },
  notifications: {
    list: ['notifications', 'list'] as const,
  },
};
