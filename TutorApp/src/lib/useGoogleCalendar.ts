import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGoogleCalendarList,
  fetchGoogleEvents,
  googleCalendarEnabled,
  requestGoogleToken,
  type GcalCalendar,
  type GcalEvent,
  type GcalToken,
} from "./googleCalendar";

const FLAG_KEY = "tutorapp:gcal-connected";

// The tutor's chosen calendar for both the read-only display and the
// create-only sync (see gcalSync.ts) — persisted per-tutor via useStore,
// same as students/lessons/etc. `calendarId: null` means "not chosen yet",
// which falls back to the account's primary calendar everywhere.
export interface GcalSyncSettings {
  calendarId: string | null;
  calendarName: string | null;
  timeZone: string | null;
}

export function useGoogleCalendar(rangeStartISO: string, rangeEndISO: string, calendarId: string | null) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<GcalEvent[]>([]);
  const [calendars, setCalendars] = useState<GcalCalendar[]>([]);
  const tokenRef = useRef<GcalToken | null>(null);
  const effectiveCalendarId = calendarId || "primary";

  const loadEvents = useCallback(
    async (token: string) => {
      try {
        const evs = await fetchGoogleEvents(token, effectiveCalendarId, rangeStartISO, rangeEndISO);
        setEvents(evs);
        setError(null);
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          setConnected(false);
          tokenRef.current = null;
        } else {
          setError(e instanceof Error ? e.message : "Не удалось загрузить события Google Calendar");
        }
      }
    },
    [rangeStartISO, rangeEndISO, effectiveCalendarId]
  );

  const connect = useCallback(
    async (interactive: boolean) => {
      if (!googleCalendarEnabled) return;
      setConnecting(true);
      setError(null);
      try {
        const token = await requestGoogleToken(interactive);
        tokenRef.current = token;
        setConnected(true);
        localStorage.setItem(FLAG_KEY, "1");
        await loadEvents(token.accessToken);
        fetchGoogleCalendarList(token.accessToken)
          .then(setCalendars)
          .catch(() => {});
      } catch (e) {
        if (interactive) setError(e instanceof Error ? e.message : "Не удалось подключиться к Google Calendar");
        localStorage.removeItem(FLAG_KEY);
      } finally {
        setConnecting(false);
      }
    },
    [loadEvents]
  );

  const disconnect = useCallback(() => {
    tokenRef.current = null;
    setConnected(false);
    setEvents([]);
    setCalendars([]);
    localStorage.removeItem(FLAG_KEY);
  }, []);

  // Returns a valid access token, silently refreshing it if needed — used by
  // sync code that needs to make its own Calendar API calls (creating
  // events) outside the read-only event-loading flow above.
  const getToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current && tokenRef.current.expiresAt > Date.now() + 30000) {
      return tokenRef.current.accessToken;
    }
    try {
      const token = await requestGoogleToken(false);
      tokenRef.current = token;
      return token.accessToken;
    } catch {
      setConnected(false);
      tokenRef.current = null;
      return null;
    }
  }, []);

  // Try a silent reconnect on mount if we were connected before.
  useEffect(() => {
    if (googleCalendarEnabled && localStorage.getItem(FLAG_KEY) === "1") {
      void connect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload events whenever the visible date range or target calendar changes.
  useEffect(() => {
    if (!connected) return;
    if (tokenRef.current && tokenRef.current.expiresAt > Date.now() + 30000) {
      void loadEvents(tokenRef.current.accessToken);
    } else {
      void connect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartISO, rangeEndISO, effectiveCalendarId, connected]);

  return {
    enabled: googleCalendarEnabled,
    connected,
    connecting,
    error,
    events,
    calendars,
    getToken,
    connect: () => connect(true),
    disconnect,
  };
}
