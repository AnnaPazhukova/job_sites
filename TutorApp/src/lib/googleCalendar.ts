// Client-side Google Calendar integration. No backend involved: Google
// Identity Services hands back a short-lived access token in the browser,
// which we use to call the Calendar API directly.

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
// Full (not readonly) scope: syncing needs to create events and list the
// tutor's calendars, not just read the primary one. Anyone already
// connected under the old readonly scope will be prompted to reconnect.
const SCOPE = "https://www.googleapis.com/auth/calendar";
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
  /** Set when this event was created by TutorSpace itself — see createGoogleEvent. */
  tutorspaceLessonId?: string;
}

interface RawGcalItem {
  id: string;
  summary?: string;
  htmlLink: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export async function fetchGoogleEvents(token: string, calendarId: string, timeMinISO: string, timeMaxISO: string): Promise<GcalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
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
        tutorspaceLessonId: item.extendedProperties?.private?.tutorspaceLessonId,
      };
    });
}

export interface GcalCalendar {
  id: string;
  summary: string;
  timeZone: string;
}

export async function fetchGoogleCalendarList(token: string): Promise<GcalCalendar[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "expired" : `Ошибка Google Calendar: ${res.status}`);
  }
  const data = (await res.json()) as { items?: { id: string; summary?: string; timeZone?: string }[] };
  return (data.items || []).map((item) => ({ id: item.id, summary: item.summary || item.id, timeZone: item.timeZone || "UTC" }));
}

export interface NewGcalEvent {
  summary: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes
  timeZone: string;
  /** Tagged onto the created event so a later sync pass recognizes it as ours and never re-imports it. */
  tutorspaceLessonId: string;
}

function addMinutesToTime(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, (m || 0) + minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export async function createGoogleEvent(token: string, calendarId: string, event: NewGcalEvent): Promise<string> {
  const end = addMinutesToTime(event.date, event.time, event.duration);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: event.summary,
      start: { dateTime: `${event.date}T${event.time}:00`, timeZone: event.timeZone },
      end: { dateTime: `${end.date}T${end.time}:00`, timeZone: event.timeZone },
      extendedProperties: { private: { tutorspaceLessonId: event.tutorspaceLessonId } },
    }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "expired" : `Ошибка Google Calendar: ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}
