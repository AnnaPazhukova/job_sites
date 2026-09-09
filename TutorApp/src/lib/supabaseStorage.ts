import { supabase } from "./supabaseClient";
import { StaleWriteError, type DataAdapter } from "./storage";

// Re-exported so existing imports of StaleWriteError from this module (its
// original home) keep working — the class itself now lives in storage.ts
// since useStore's conflict-retry logic needs to reference it too, and
// storage.ts can't import from here without a circular dependency.
export { StaleWriteError };

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

  // Bypasses loadAll()'s memoized snapshot (fixed as of this tab's first
  // load) to read this one key's current server row directly, updating the
  // conflict-detection cache as it goes. useStore calls this to retry a save
  // after a StaleWriteError against fresh data instead of the tab's stale
  // copy — get() alone would just keep returning that same stale snapshot.
  async refetch<T>(key: string): Promise<T | null> {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return null;

    const { data, error } = await supabase.from("app_kv").select("value, updated_at").eq("user_id", userId).eq("key", key).maybeSingle();
    if (error || !data) return null;

    lastKnownUpdatedAt[`${userId}:${key}`] = data.updated_at;
    if (this.allRowsPromise) {
      this.allRowsPromise = this.allRowsPromise.then((all) => ({ ...all, [key]: data.value }));
    }
    return data.value as T;
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
      // No row was seen for this key yet — could be genuinely new, or it
      // could be that loadAll() simply hasn't resolved yet in this tab (a
      // caller firing set() before its own get() finished). Those two cases
      // look identical here, so a plain upsert is NOT safe: if a row for
      // this key already exists on the server, upsert would silently
      // overwrite it with no conflict check at all — exactly how a stale
      // "seed the app once" effect once clobbered a tutor's real data. Use
      // insert instead: if the row is genuinely new it succeeds same as
      // upsert would; if it already exists, the (user_id, key) primary key
      // rejects it with a unique-violation, which is treated the same as a
      // stale write below rather than overwriting.
      const { data, error } = await supabase
        .from("app_kv")
        .insert({ user_id: userId, key, value: value as object, updated_at: nowIso })
        .select("updated_at")
        .single();
      if (error) {
        if (error.code === "23505") throw new StaleWriteError(key);
        // Previously ignored: a write that Supabase rejected (RLS, network,
        // quota) looked identical here to one that succeeded, so the UI kept
        // showing the new value as saved right up until the next reload
        // quietly reverted it — surfacing the error lets callers (see
        // useStore) tell the tutor the save didn't actually go through.
        throw error;
      }
      lastKnownUpdatedAt[cacheKey] = data?.updated_at ?? nowIso;
    }

    // Keep the cached snapshot in sync so a later get() (e.g. a remount)
    // sees this write instead of stale pre-write data.
    if (this.allRowsPromise) {
      this.allRowsPromise = this.allRowsPromise.then((all) => ({ ...all, [key]: value }));
    }
  }
}
