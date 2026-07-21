import { supabase } from "./supabaseClient";
import type { DataAdapter } from "./storage";

// Stores every data slice as one row per (user, key) in public.app_kv,
// scoped by Supabase Auth + row-level security (see supabase/schema.sql).
// Mirrors the shape of LocalStorageAdapter so useStore doesn't need to know
// which backend it's talking to.
export class SupabaseAdapter implements DataAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("app_kv")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;
    return data.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    await supabase.from("app_kv").upsert({
      user_id: userId,
      key,
      value: value as object,
      updated_at: new Date().toISOString(),
    });
  }
}
