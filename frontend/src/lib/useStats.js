import { useEffect, useState } from 'react';
import { statsApi } from '@/lib/api';

/**
 * Hook: polls /api/stats/subscriptions every `intervalMs` (default 15s).
 * Returns { stats, loading, error, refresh }.
 */
export function useSubscriptionStats(intervalMs = 15000) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const { data } = await statsApi.subscriptions();
      setStats(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    refresh();
    const id = setInterval(() => {
      if (mounted) refresh();
    }, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { stats, loading, error, refresh };
}
