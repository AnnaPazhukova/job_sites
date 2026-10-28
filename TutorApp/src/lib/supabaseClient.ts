import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
// A path like "/supabase" targets a same-origin reverse proxy (see
// netlify.toml); supabase-js needs an absolute URL, so resolve it here.
const url = rawUrl?.startsWith("/")
  ? `${window.location.origin}${rawUrl}`
  : rawUrl;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase is optional: without these two build-time env vars the app falls
// back to browser-local storage (see src/lib/storage.ts), so local dev works
// without a Supabase project.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
