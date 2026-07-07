import { useCallback, useEffect, useState } from 'react';

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);

  const run = useCallback(() => {
    setLoading(true);
    setError('');
    return fetcher()
      .then((d) => {
        setData(d);
        setError('');
        return d;
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Request failed';
        setError(message);
        throw e;
      })
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    fetcher()
      .then((d) => {
        if (active) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : 'Request failed');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [...deps, enabled]);

  return { data, error, loading, setData, setError, reload: run };
}
