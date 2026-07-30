import { useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { fileStorageEnabled, uploadAttachment } from "../lib/fileStorage";
import type { Attachment } from "../lib/types";

interface Props {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  label?: string;
  folder?: string;
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) =>
        a.mimeType?.startsWith("image/") ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition">
            <img src={a.url} alt={a.name} className="h-24 w-24 object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            download={a.name}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 max-w-[220px] transition"
          >
            <Paperclip size={12} className="shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        )
      )}
    </div>
  );
}

export function AttachmentsField({ attachments, onChange, label = "Файлы", folder }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadAttachment(f, folder)));
      onChange([...attachments, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    onChange(attachments.filter((a) => a.id !== id));
  }

  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-1.5">{label}</div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              download={a.name}
              className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 max-w-[220px] transition"
            >
              <Paperclip size={12} className="shrink-0" />
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(a.id);
                }}
                className="shrink-0 p-0.5 rounded hover:bg-gray-300 opacity-60 hover:opacity-100"
              >
                <X size={11} />
              </button>
            </a>
          ))}
        </div>
      )}
      {fileStorageEnabled ? (
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer transition">
          <Upload size={14} /> {uploading ? "Загрузка..." : "Прикрепить файл"}
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
          Загрузка файлов появится после подключения Supabase (см. README, раздел «Supabase Storage»).
        </div>
      )}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
