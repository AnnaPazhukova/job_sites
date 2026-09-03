import { supabase } from "./supabaseClient";
import type { DataAdapter } from "./storage";

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

        const { data, error } = await supabase.from("app_kv").select("key, value").eq("user_id", userId);
        if (error || !data) return {};

        const out: Record<string, unknown> = {};
        for (const row of data) out[row.key] = row.value;
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

    const { error } = await supabase.from("app_kv").upsert({
      user_id: userId,
      key,
      value: value as object,
      updated_at: new Date().toISOString(),
    });
    // Previously ignored: a write that Supabase rejected (RLS, network,
    // quota) looked identical here to one that succeeded, so the UI kept
    // showing the new value as saved right up until the next reload quietly
    // reverted it — surfacing the error lets callers (see useStore) tell the
    // tutor the save didn't actually go through.
    if (error) throw error;

    // Keep the cached snapshot in sync so a later get() (e.g. a remount)
    // sees this write instead of stale pre-write data.
    if (this.allRowsPromise) {
      this.allRowsPromise = this.allRowsPromise.then((all) => ({ ...all, [key]: value }));
    }
  }
}
