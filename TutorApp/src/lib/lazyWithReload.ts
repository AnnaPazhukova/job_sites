import { lazy, type ComponentType } from "react";
import { reloadOnce } from "./reloadOnce";

// React.lazy that recovers from a stale chunk reference (tab opened before a
// deploy, chunk URL no longer exists). Two failure shapes: the import rejects,
// or it resolves without a usable default export — in which case React.lazy
// itself throws "...._result.default" TypeError. Both mean the tab's
// index.html is outdated, so a reload fixes it. Reloading here, before React
// sees the broken module, keeps the error out of the ErrorBoundary and Sentry.
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (mod && mod.default) return mod;
      throw new Error("Lazy module has no default export");
    } catch (error) {
      // Never resolves: the page is about to reload, so keep Suspense showing
      // its fallback instead of rendering (or throwing) anything.
      if (reloadOnce("reloaded-after-lazy-error")) return new Promise<never>(() => {});
      throw error;
    }
  });
}
