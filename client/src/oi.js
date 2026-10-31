import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { marketOpen } from './rules';

// Polls the server for live Nifty OI. 30 s while the market is open, 3 min otherwise.
export function useOi(expiry, nearDays) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    try {
      const data = await api.oi(expiry, nearDays);
      set({ data, error: null, loading: false });
    } catch (e) {
      set((s) => ({ data: s.data, error: e.detail ? `${e.message} (${e.detail})` : e.message, loading: false }));
    }
  }, [expiry, nearDays]);
  useEffect(() => {
    load();
    const id = setInterval(load, marketOpen() ? 30_000 : 180_000);
    return () => clearInterval(id);
  }, [load]);
  return { ...state, reload: load };
}
