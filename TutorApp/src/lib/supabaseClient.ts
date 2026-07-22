import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase is optional: without these two build-time env vars the app falls
// back to browser-local storage (see src/lib/storage.ts), so local dev works
// without a Supabase project.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
