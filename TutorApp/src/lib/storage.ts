import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Data access is behind this adapter interface so the localStorage
 * implementation can be swapped for a real backend (REST/Supabase/etc.)
 * later without touching any view code.
 */
export interface DataAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  // Bypasses any in-memory cache the adapter keeps and reads this key's
  // current server value directly. Optional because it only matters for
  // adapters with real cross-client concurrency (SupabaseAdapter) — useStore
  // uses it to retry a save after a StaleWriteError against fresh data
  // instead of this tab's stale copy. LocalStorageAdapter has no server to
  // diverge from, so it doesn't implement this (and its set() never throws
  // StaleWriteError, so the retry path that would call it never triggers).
  refetch?<T>(key: string): Promise<T | null>;
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

// Thrown by an adapter's set() when the stored value for `key` changed on
// the server after this adapter last read it — another tab, another device,
// or (for keys the student portal can write to directly, like lessons,
// homework, and messages) a portal action such as a cancellation request or
// a chat message. See useStore below for how a caller that passes an
// updater function gets this resolved automatically instead of the edit
// silently never reaching the server.
export class StaleWriteError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`"${key}" was changed elsewhere since this tab last loaded it`);
    this.name = "StaleWriteError";
    this.key = key;
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

// Mirrors React's setState: pass the next value directly, or a function that
// computes it from the previous value. Only the function form can be safely
// retried after a conflict (see persist() below) — a plain value has no
// notion of "previous state" to recompute against fresher server data, so
// callers that want their edit to survive a concurrent portal write (a
// student cancelling a lesson, sending a message, submitting homework) while
// this tab was open should prefer it over a value computed from the current
// closure.
export type Updater<T> = T | ((prev: T) => T);

export function useStore<T>(key: string, initial: T): [T, (next: Updater<T>) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  // Read synchronously inside persist() below, since two persist() calls can
  // fire back-to-back before React re-renders and `value` catches up.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await dataAdapter.get<T>(key);
      if (!cancelled) {
        if (stored != null) {
          valueRef.current = stored;
          setValue(stored);
        }
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: Updater<T>) => {
      const isUpdater = typeof next === "function";
      const applied = isUpdater ? (next as (prev: T) => T)(valueRef.current) : (next as T);
      valueRef.current = applied;
      setValue(applied);

      dataAdapter.set(key, applied).catch(async (err) => {
        // A conflict means the server's copy of this key moved since this
        // tab last read it. If the caller gave us an updater, recompute it
        // against a fresh server read instead of this tab's stale snapshot
        // — that reapplies just the intended change on top of whatever
        // changed elsewhere (e.g. a student's cancellation request), rather
        // than either losing the edit or clobbering theirs. A plain value
        // has nothing to recompute from, so it falls straight through to
        // the same "tell the tutor to refresh" path as a repeated conflict.
        if (isUpdater && err instanceof StaleWriteError && dataAdapter.refetch) {
          try {
            const fresh = (await dataAdapter.refetch<T>(key)) ?? valueRef.current;
            const merged = (next as (prev: T) => T)(fresh);
            await dataAdapter.set(key, merged);
            valueRef.current = merged;
            setValue(merged);
            return;
          } catch (retryErr) {
            onPersistError?.(key, retryErr);
            return;
          }
        }
        onPersistError?.(key, err);
      });
    },
    [key]
  );

  return [value, persist, loaded];
}
