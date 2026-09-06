import { supabase } from "./supabaseClient";
import type { DataAdapter } from "./storage";

// Thrown by SupabaseAdapter.set() when the row for `key` was changed on the
// server (by another tab, another device, or a student-portal action like
// sending a message) after this adapter last read it. A tab that's been
// open a while holds a stale in-memory copy of that key; saving on top of
// it would silently overwrite whatever changed in the meantime. Surfacing
// this as a distinct error (see App.tsx's persist-error handler) lets the
// UI tell the tutor to refresh instead of clobbering the newer data.
export class StaleWriteError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`"${key}" was changed elsewhere since this tab last loaded it`);
    this.name = "StaleWriteError";
    this.key = key;
  }
}

// The `updated_at` last seen for each (user, key), used as an
// optimistic-concurrency token in set(): a write only lands if the row's
// updated_at on the server still matches what was last read. This lives at
// module scope, not on the SupabaseAdapter instance — AuthGate installs a
// *new* SupabaseAdapter on every auth-state change, including the periodic
// TOKEN_REFRESHED events a signed-in session keeps getting, and an
// instance-local map would be wiped out by that churn, silently falling
// back to an unprotected upsert right when the protection matters most.
// Keyed by `${userId}:${key}` so switching accounts in the same tab can't
// compare against a previous user's timestamp.
const lastKnownUpdatedAt: Record<string, string> = {};

// Stores every data slice as one row per (user, key) in public.app_kv,
// scoped by Supabase Auth + row-level security (see supabase/schema.sql).
// Mirrors the shape of LocalStorageAdapter so useStore doesn't need to know
// which backend it's talking to.
export class SupabaseAdapter implements DataAdapter {
  // App.tsx mounts one useStore() per data key (students, lessons, homework,
  // messages, tasks, methodology-notes, seed-flags — see App.tsx), and they
  // all fetch on the same initial render. Without this, that's N separate
  // round trips (each preceded by its own getSession() call) every time the
  // app loads, which is most of why the app used to feel slow to open —
  // memoizing one batched "every row for this user" query means the first
  // get() call fetches everything at once and the rest just read from it.
  // Unlike lastKnownUpdatedAt above, this one *should* reset when AuthGate
  // swaps in a new adapter (e.g. a different user signs in) rather than
  // persist across it, so it stays per-instance.
  private allRowsPromise: Promise<Record<string, unknown>> | null = null;

  private loadAll(): Promise<Record<string, unknown>> {
    if (!this.allRowsPromise) {
      this.allRowsPromise = (async () => {
        if (!supabase) return {};
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user.id;
        if (!userId) return {};

        const { data, error } = await supabase.from("app_kv").select("key, value, updated_at").eq("user_id", userId);
        if (error || !data) return {};

        const out: Record<string, unknown> = {};
        for (const row of data) {
          out[row.key] = row.value;
          lastKnownUpdatedAt[`${userId}:${row.key}`] = row.updated_at;
        }
        return out;
      })();
    }
    return this.allRowsPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const all = await this.loadAll();
    return key in all ? (all[key] as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) throw new Error("Не авторизован");

    const nowIso = new Date().toISOString();
    const cacheKey = `${userId}:${key}`;
    const knownUpdatedAt = lastKnownUpdatedAt[cacheKey];

    if (knownUpdatedAt) {
      // A row for this key existed the last time it was read here — only
      // overwrite it if it hasn't changed on the server since, so a save
      // from a stale tab can't silently clobber a fresher one made
      // elsewhere. The updated_at match is the precondition; if zero rows
      // come back, someone else's write already moved it forward.
      const { data, error } = await supabase
        .from("app_kv")
        .update({ value: value as object, updated_at: nowIso })
        .eq("user_id", userId)
        .eq("key", key)
        .eq("updated_at", knownUpdatedAt)
        .select("updated_at");
      if (error) throw error;
      if (!data || data.length === 0) throw new StaleWriteError(key);
      lastKnownUpdatedAt[cacheKey] = nowIso;
    } else {
      // No row was seen for this key yet (genuinely new, or loadAll()
      // hasn't run) — nothing to conflict with, so a plain upsert is safe.
      const { data, error } = await supabase
        .from("app_kv")
        .upsert({ user_id: userId, key, value: value as object, updated_at: nowIso })
        .select("updated_at")
        .single();
      // Previously ignored: a write that Supabase rejected (RLS, network,
      // quota) looked identical here to one that succeeded, so the UI kept
      // showing the new value as saved right up until the next reload
      // quietly reverted it — surfacing the error lets callers (see
      // useStore) tell the tutor the save didn't actually go through.
      if (error) throw error;
      lastKnownUpdatedAt[cacheKey] = data?.updated_at ?? nowIso;
    }

    // Keep the cached snapshot in sync so a later get() (e.g. a remount)
    // sees this write instead of stale pre-write data.
    if (this.allRowsPromise) {
      this.allRowsPromise = this.allRowsPromise.then((all) => ({ ...all, [key]: value }));
    }
  }
}
