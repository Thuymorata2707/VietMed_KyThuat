import { useCallback, useEffect, useState } from 'react';

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await load()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu.'); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);
  return { data, loading, error, refresh };
}
