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

export class LocalStorageAdapter implements DataAdapter {
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

// Swappable at runtime: AuthGate points this at a SupabaseAdapter once a
// user is signed in, before the data-driven <App/> ever mounts.
export let dataAdapter: DataAdapter = new LocalStorageAdapter();

export function setDataAdapter(adapter: DataAdapter) {
  dataAdapter = adapter;
}

// useStore updates its local state immediately (so typing/clicking feels
// instant) and persists in the background — a save that then fails would
// otherwise be silently lost: the screen keeps showing the new value until
// the next reload quietly reverts it. Registering a handler here (App.tsx
// does this once, wiring it to a toast) is how that failure becomes visible
// instead of invisible data loss.
type PersistErrorHandler = (key: string, error: unknown) => void;
let onPersistError: PersistErrorHandler | null = null;

export function setPersistErrorHandler(handler: PersistErrorHandler | null) {
  onPersistError = handler;
}

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
      dataAdapter.set(key, next).catch((err) => onPersistError?.(key, err));
    },
    [key]
  );

  return [value, persist, loaded];
}
