import { supabase } from "./supabaseClient";
import { uid } from "./utils";

export interface StudentLink {
  tutorId: string;
  studentId: string;
}

export const studentPortalEnabled = Boolean(supabase);

// If the current session belongs to a student (linked via an accepted
// invite), returns which tutor/student record it maps to. Returns null for
// a tutor session, a signed-out session, or when Supabase isn't configured.
export async function getStudentLink(): Promise<StudentLink | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("student_accounts")
    .select("tutor_id, student_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return { tutorId: data.tutor_id, studentId: data.student_id };
}

export function getInviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("invite");
}

export async function claimInvite(code: string): Promise<void> {
  if (!supabase) throw new Error("Личный кабинет ученика недоступен: база данных не подключена");
  const { error } = await supabase.rpc("claim_student_invite", { p_code: code });
  if (error) throw error;
}

export async function createInvite(studentId: string): Promise<string> {
  if (!supabase) throw new Error("Личный кабинет ученика недоступен: база данных не подключена");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const tutorId = session?.user.id;
  if (!tutorId) throw new Error("Не авторизован");

  const code = uid() + uid();
  const { error } = await supabase.from("student_invites").insert({ code, tutor_id: tutorId, student_id: studentId });
  if (error) throw error;
  return code;
}

// Claims the invite if it hasn't been used yet; if it was already claimed by
// this same account (e.g. re-visiting the invite link after signing in
// again), treats that as success instead of surfacing the "already used"
// error.
export async function ensureLinked(code: string): Promise<void> {
  try {
    await claimInvite(code);
  } catch (err) {
    const link = await getStudentLink();
    if (!link) throw err;
  }
}

export function inviteLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = `?invite=${code}`;
  url.hash = "";
  return url.toString();
}
