import { supabase } from "./supabaseClient";
import type { Attachment, ChatMessage, Homework, Lesson, MethodNote, Student } from "./types";

async function getData<T>(key: string): Promise<T> {
  if (!supabase) return [] as unknown as T;
  const { data, error } = await supabase.rpc("student_get_data", { p_key: key });
  if (error) throw error;
  return (data ?? []) as T;
}

export const fetchStudentLessons = () => getData<Lesson[]>("lessons");
export const fetchStudentHomework = () => getData<Homework[]>("homework");
export const fetchStudentMessages = () => getData<ChatMessage[]>("messages");
export const fetchStudentLinkedNotes = () => getData<MethodNote[]>("linked-notes");

export async function fetchStudentProfile(): Promise<Student | null> {
  const list = await getData<Student[]>("students");
  return list[0] || null;
}

export async function sendStudentMessage(text: string, attachments: Attachment[] = []): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("student_send_message", { p_text: text, p_attachments: attachments });
  if (error) throw error;
}

export async function markStudentHomeworkDone(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("student_mark_homework_done", { p_homework_id: id });
  if (error) throw error;
}
