import { supabase } from "./supabaseClient";
import { uid } from "./utils";
import type { Attachment } from "./types";

// File attachments (homework, methodology lessons) live in a Supabase
// Storage bucket, scoped per user by folder — see supabase/schema.sql for
// the bucket + policies. Without Supabase configured there is nowhere to
// durably store binary files, so uploads are simply unavailable.
const BUCKET = "attachments";

export const fileStorageEnabled = Boolean(supabase);

// `folder` overrides the default per-tutor (auth.uid()) folder — used by
// the student portal, which has no Supabase Auth session at all (access is
// by link code, see studentAuth.ts). Passing `portal-<code>` there matches
// the matching storage policy in supabase/schema.sql, which authorizes the
// upload by checking the code against student_invites instead of auth.uid().
export async function uploadAttachment(file: File, folder?: string): Promise<Attachment> {
  if (!supabase) throw new Error("Хранилище файлов недоступно");

  let owner = folder;
  if (!owner) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    owner = session?.user.id;
  }
  if (!owner) throw new Error("Не авторизован");

  const id = uid();
  const path = `${owner}/${id}-${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { id, name: file.name, url: data.publicUrl, mimeType: file.type, size: file.size };
}
