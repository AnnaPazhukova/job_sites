import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGoogleEvents, googleCalendarEnabled, requestGoogleToken, type GcalEvent, type GcalToken } from "./googleCalendar";

const FLAG_KEY = "tutorapp:gcal-connected";

export function useGoogleCalendar(rangeStartISO: string, rangeEndISO: string) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<GcalEvent[]>([]);
  const tokenRef = useRef<GcalToken | null>(null);

  const loadEvents = useCallback(async (token: string) => {
    try {
      const evs = await fetchGoogleEvents(token, rangeStartISO, rangeEndISO);
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
  }, [rangeStartISO, rangeEndISO]);

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
    localStorage.removeItem(FLAG_KEY);
  }, []);

  // Try a silent reconnect on mount if we were connected before.
  useEffect(() => {
    if (googleCalendarEnabled && localStorage.getItem(FLAG_KEY) === "1") {
      void connect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload events whenever the visible date range changes.
  useEffect(() => {
    if (!connected) return;
    if (tokenRef.current && tokenRef.current.expiresAt > Date.now() + 30000) {
      void loadEvents(tokenRef.current.accessToken);
    } else {
      void connect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartISO, rangeEndISO, connected]);

  return {
    enabled: googleCalendarEnabled,
    connected,
    connecting,
    error,
    events,
    connect: () => connect(true),
    disconnect,
  };
}
