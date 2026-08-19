import { supabase } from "./supabaseClient";
import type { Attachment, ChatMessage, Homework, Lesson, MethodNote, Student } from "./types";

async function getData<T>(code: string, key: string): Promise<T> {
  if (!supabase) return [] as unknown as T;
  const { data, error } = await supabase.rpc("portal_get_data", { p_code: code, p_key: key });
  if (error) throw error;
  return (data ?? []) as T;
}

export const fetchStudentLessons = (code: string) => getData<Lesson[]>(code, "lessons");
export const fetchStudentHomework = (code: string) => getData<Homework[]>(code, "homework");
export const fetchStudentMessages = (code: string) => getData<ChatMessage[]>(code, "messages");
export const fetchStudentLinkedNotes = (code: string) => getData<MethodNote[]>(code, "linked-notes");

export async function fetchStudentProfile(code: string): Promise<Student | null> {
  const list = await getData<Student[]>(code, "students");
  return list[0] || null;
}

export async function sendStudentMessage(code: string, text: string, attachments: Attachment[] = []): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("portal_send_message", { p_code: code, p_text: text, p_attachments: attachments });
  if (error) throw error;
}

export async function markStudentHomeworkDone(code: string, id: string, attachments: Attachment[] = []): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("portal_mark_homework_done", { p_code: code, p_homework_id: id, p_attachments: attachments });
  if (error) throw error;
}

export async function requestLessonCancel(code: string, lessonId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("portal_request_lesson_cancel", { p_code: code, p_lesson_id: lessonId });
  if (error) throw error;
}
