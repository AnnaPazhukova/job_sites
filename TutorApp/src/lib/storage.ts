import { useCallback, useEffect, useState } from "react";

/**
 * Data access is behind this adapter interface so the localStorage
 * implementation can be swapped for a real backend (REST/Supabase/etc.)
 * later without touching any view code.
 */
export interface DataAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

const NAMESPACE = "tutorapp:";

class LocalStorageAdapter implements DataAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(NAMESPACE + key);
      return raw != null ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
  }
}

export const dataAdapter: DataAdapter = new LocalStorageAdapter();

export function useStore<T>(key: string, initial: T): [T, (next: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await dataAdapter.get<T>(key);
      if (!cancelled) {
        if (stored != null) setValue(stored);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: T) => {
      setValue(next);
      void dataAdapter.set(key, next);
    },
    [key]
  );

  return [value, persist, loaded];
}
