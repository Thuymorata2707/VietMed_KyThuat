import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ApiRequestError, ApiUser, apiFetch, clearToken, getStoredUser, getToken, setStoredUser } from './api';
import { Splash } from './components/Splash';
import { AppShell } from './layouts/AppShell';
import { queryClient } from './lib/queryClient';
import { queryKeys } from './lib/queryKeys';
import { LoginPage } from './pages/LoginPage';

function App() {
  const [user, setUser] = useState<ApiUser | null>(() => (getToken() || getStoredUser() ? getStoredUser() : null));
  const hasStoredSession = Boolean(getToken() || getStoredUser());
  const currentUserQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiFetch<ApiUser>('/auth/me'),
    enabled: hasStoredSession,
    retry: false,
  });

  useEffect(() => {
    if (!hasStoredSession) {
      setUser(null);
      return;
    }

    if (currentUserQuery.data) {
      setStoredUser(currentUserQuery.data);
      setUser(currentUserQuery.data);
    }

    if (
      currentUserQuery.error instanceof ApiRequestError &&
      [401, 403].includes(currentUserQuery.error.statusCode)
    ) {
      clearToken();
      queryClient.clear();
      setUser(null);
    }
  }, [currentUserQuery.data, currentUserQuery.error, hasStoredSession]);

  const checkingSession = hasStoredSession && currentUserQuery.isPending && !user;

  if (checkingSession) {
    return <Splash />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={setUser} />} />
      <Route
        path="/*"
        element={
          user ? (
            <AppShell
              onLogout={() => setUser(null)}
              onUserUpdated={(updatedUser) => {
                setStoredUser(updatedUser);
                setUser(updatedUser);
              }}
              user={user}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
