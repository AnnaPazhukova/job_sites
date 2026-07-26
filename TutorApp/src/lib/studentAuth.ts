import { supabase } from "./supabaseClient";
import { secureToken } from "./utils";

export const studentPortalEnabled = Boolean(supabase);

const PORTAL_CODE_KEY = "tutorspace:portal-code";

export function getInviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("invite");
}

export function storePortalCode(code: string) {
  localStorage.setItem(PORTAL_CODE_KEY, code);
}

export function getStoredPortalCode(): string | null {
  return localStorage.getItem(PORTAL_CODE_KEY);
}

export function clearStoredPortalCode() {
  localStorage.removeItem(PORTAL_CODE_KEY);
}

// The tutor's existing access link for a student, if one was already
// created — so "Пригласить в кабинет" shows the same link again instead of
// silently minting a new one every time the button is pressed.
export async function getExistingAccessLink(studentId: string): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const tutorId = session?.user.id;
  if (!tutorId) return null;

  const { data } = await supabase
    .from("student_invites")
    .select("code")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.code ?? null;
}

export async function createInvite(studentId: string): Promise<string> {
  if (!supabase) throw new Error("Личный кабинет ученика недоступен: база данных не подключена");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const tutorId = session?.user.id;
  if (!tutorId) throw new Error("Не авторизован");

  const code = secureToken();
  const { error } = await supabase.from("student_invites").insert({ code, tutor_id: tutorId, student_id: studentId });
  if (error) throw error;
  return code;
}

// Revokes a student's access link — after this, the old link stops working.
export async function revokeAccessLink(code: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("student_invites").delete().eq("code", code);
  if (error) throw error;
}

export function inviteLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = `?invite=${code}`;
  url.hash = "";
  return url.toString();
}
