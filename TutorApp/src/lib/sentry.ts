import * as Sentry from "@sentry/react";

// Error monitoring — see .env.example for how to set VITE_SENTRY_DSN.
// Without a DSN (local dev by default, or a deploy where the secret hasn't
// been configured yet) this is a no-op: every Sentry.* call below is safe
// to make regardless of whether init() below ever ran.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? "production" : "development",
    // Errors only, no session replay/tracing — this is a small single-tutor
    // app, not a place that needs performance monitoring, and every event
    // here is real tutor/student usage rather than synthetic traffic.
    tracesSampleRate: 0,
  });
}

// Reported alongside the toast a save failure already shows the tutor (see
// App.tsx's persist-error handler) — that toast is easy to miss or happen
// while she's not looking, and this class of "a write silently didn't
// reach the server" bug is exactly what caused every data-loss incident
// this app has had. Surfacing it here means it's visible without her
// having to notice and report it first.
export function reportPersistError(key: string, error: unknown) {
  const tags: Record<string, string> = { source: "persist", key };
  // A failed Supabase/PostgREST write throws a plain {code, details, hint,
  // message} object rather than an Error instance, so Sentry's default
  // capture only shows "Object captured as exception with keys: ..." in the
  // alert — unreadable without opening the dashboard. Pulling the actual
  // string values into tags surfaces them directly in the alert email.
  if (error && typeof error === "object" && !(error instanceof Error)) {
    for (const field of ["code", "message", "details", "hint"] as const) {
      const value = (error as Record<string, unknown>)[field];
      if (typeof value === "string" && value) tags[`db_${field}`] = value;
    }
  }
  Sentry.captureException(error, { tags });
}

export { Sentry };
