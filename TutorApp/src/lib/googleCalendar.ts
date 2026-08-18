// Client-side Google Calendar integration (read-only). No backend involved:
// Google Identity Services hands back a short-lived access token in the
// browser, which we use to call the Calendar API directly.

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GIS_SRC = "https://accounts.google.com/gsi/client";

export const googleCalendarEnabled = Boolean(CLIENT_ID);

let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface GcalToken {
  accessToken: string;
  expiresAt: number;
}

export async function requestGoogleToken(interactive: boolean): Promise<GcalToken> {
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID не задан");
  await loadGisScript();
  if (!window.google) throw new Error("Google Identity Services недоступен");

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "auth_error"));
          return;
        }
        resolve({ accessToken: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 });
      },
      error_callback: (err) => reject(new Error(err?.type || "auth_error")),
    });
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

export interface GcalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD, local wall-clock date of the event
  time: string | null; // HH:MM, null for all-day events
  endTime: string | null;
  allDay: boolean;
  htmlLink: string;
}

interface RawGcalItem {
  id: string;
  summary?: string;
  htmlLink: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export async function fetchGoogleEvents(token: string, timeMinISO: string, timeMaxISO: string): Promise<GcalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "expired" : `Ошибка Google Calendar: ${res.status}`);
  }
  const data = (await res.json()) as { items?: RawGcalItem[] };
  return (data.items || [])
    .filter((item) => item.start)
    .map((item) => {
      const allDay = !!item.start!.date;
      const date = allDay ? item.start!.date! : item.start!.dateTime!.slice(0, 10);
      const time = allDay ? null : item.start!.dateTime!.slice(11, 16);
      const endTime = allDay ? null : item.end?.dateTime?.slice(11, 16) || null;
      return {
        id: item.id,
        title: item.summary || "Без названия",
        date,
        time,
        endTime,
        allDay,
        htmlLink: item.htmlLink,
      };
    });
}
