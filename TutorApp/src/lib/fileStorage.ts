import { supabase } from "./supabaseClient";
import { uid } from "./utils";
import type { Attachment } from "./types";

// File attachments (homework, methodology lessons) live in a Supabase
// Storage bucket, scoped per user by folder — see supabase/schema.sql for
// the bucket + policies. Without Supabase configured there is nowhere to
// durably store binary files, so uploads are simply unavailable.
const BUCKET = "attachments";

export const fileStorageEnabled = Boolean(supabase);

export async function uploadAttachment(file: File): Promise<Attachment> {
  if (!supabase) throw new Error("Хранилище файлов недоступно");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) throw new Error("Не авторизован");

  const id = uid();
  const path = `${userId}/${id}-${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { id, name: file.name, url: data.publicUrl, mimeType: file.type, size: file.size };
}
