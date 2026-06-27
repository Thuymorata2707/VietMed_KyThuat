import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiRequestError, clearToken } from '../api';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        clearToken();
        queryClient.clear();
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
