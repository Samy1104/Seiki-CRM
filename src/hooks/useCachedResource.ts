import { useEffect, useRef, useState } from 'react';

interface CacheEntry<T> {
  data: T;
}

const STORAGE_KEY = 'seiki:cachedResources';

/**
 * Also persisted to sessionStorage: a hard page refresh reloads the whole JS
 * app, which would otherwise wipe this module-level cache and bring back the
 * loading flash on every refresh, not just SPA navigations. sessionStorage
 * scopes it to the current browser tab so it clears on tab close.
 */
function loadPersistedCache(): Map<string, CacheEntry<unknown>> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return new Map(Object.entries(parsed).map(([key, data]) => [key, { data }]));
  } catch {
    return new Map();
  }
}

const cache = loadPersistedCache();

function persistCache(): void {
  try {
    const obj: Record<string, unknown> = {};
    cache.forEach((entry, key) => { obj[key] = entry.data; });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // storage unavailable/full — cache still works in-memory for this session
  }
}

export function invalidateCachedResource(key: string): void {
  cache.delete(key);
  persistCache();
}

interface Options {
  onError?: (err: unknown) => void;
}

/**
 * Shares fetched data across every component using the same `key`. First
 * caller for a key pays the loading spinner; later callers (e.g. navigating
 * back to a page) render the cached value instantly and revalidate quietly
 * in the background.
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  initialValue: T,
  options: Options = {}
): {
  data: T;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T) => T)) => void;
} {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const [data, setDataState] = useState<T>(cached ? cached.data : initialValue);
  const [loading, setLoading] = useState(!cached);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const fetchAndStore = async () => {
    try {
      const result = await fetcherRef.current();
      cache.set(key, { data: result });
      persistCache();
      setDataState(result);
    } catch (err) {
      onErrorRef.current?.(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const existing = cache.get(key) as CacheEntry<T> | undefined;
    if (existing) {
      setDataState(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchAndStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setData = (updater: T | ((prev: T) => T)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
      cache.set(key, { data: next });
      persistCache();
      return next;
    });
  };

  return { data, loading, reload: fetchAndStore, setData };
}
