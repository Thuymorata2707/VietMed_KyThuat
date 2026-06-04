import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ApiUser, apiFetch, clearToken, getToken } from './api';
import { Splash } from './components/Splash';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';

function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }

    apiFetch<ApiUser>('/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <Splash />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={setUser} />} />
      <Route
        path="/*"
        element={
          user ? <AppShell user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

export default App;
