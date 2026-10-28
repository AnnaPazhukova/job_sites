// Guards against reload loops: a given cause may trigger a reload again only
// after the window below has passed (a later deploy while the tab stays open),
// but never twice in a row for the same failure (e.g. actually offline).
const RELOAD_WINDOW_MS = 60_000;

// Returns true if a reload was started, false if one already happened
// recently for this key (or sessionStorage is unavailable).
export function reloadOnce(key: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(key));
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
