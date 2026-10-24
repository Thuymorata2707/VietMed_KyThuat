import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, AppUser } from '@/api/auth.api';
import { clearToken, onTokenInvalidated, readToken, saveToken } from '@/services/token-storage';

type AuthContextValue = { user: AppUser | null; loading: boolean; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onTokenInvalidated(() => setUser(null)), []);
  useEffect(() => {
    void (async () => {
      try { if (await readToken()) setUser(await authApi.me()); }
      catch { await clearToken(); }
      finally { setLoading(false); }
    })();
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    async signIn(email, password) {
      const result = await authApi.login(email, password);
      await saveToken(result.access_token);
      setUser(result.user);
    },
    async signOut() { await clearToken(); setUser(null); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
