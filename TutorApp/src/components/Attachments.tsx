import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Paperclip, Upload, X } from "lucide-react";
import { fileStorageEnabled, uploadAttachment } from "../lib/fileStorage";
import { getPdfPageCount, renderPdfPageToCanvas } from "../lib/pdfPages";
import type { Attachment } from "../lib/types";

interface Props {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  label?: string;
  folder?: string;
}

const isImage = (a: Attachment) => a.mimeType?.startsWith("image/");
const isPdf = (a: Attachment) => a.mimeType === "application/pdf";

function PdfThumb({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      title={a.name}
      className="group/thumb relative flex flex-col items-center justify-center gap-1 h-24 w-24 rounded-xl overflow-hidden border border-red-200 bg-red-50 shadow-sm hover:shadow hover:bg-red-100 transition px-1.5"
    >
      <FileText size={22} className="text-red-500 shrink-0" />
      <span className="text-[10px] font-semibold text-red-600 truncate w-full text-center">{a.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/40 text-white opacity-0 group-hover/thumb:opacity-100 hover:bg-black/60 transition"
        >
          <X size={12} />
        </button>
      )}
    </a>
  );
}

function ImageThumb({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      title={a.name}
      className="group/thumb relative block h-24 w-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow transition"
    >
      <img src={a.url} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover/thumb:opacity-100 hover:bg-black/70 transition"
        >
          <X size={12} />
        </button>
      )}
    </a>
  );
}

function FilePill({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.name}
      className={`group inline-flex items-center gap-1.5 pl-2.5 ${onRemove ? "pr-1.5" : "pr-3"} py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 max-w-[220px] transition`}
    >
      <Paperclip size={12} className="shrink-0" />
      <span className="truncate">{a.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 p-0.5 rounded hover:bg-gray-300 opacity-60 hover:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </a>
  );
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) =>
        isImage(a) ? <ImageThumb key={a.id} a={a} /> : isPdf(a) ? <PdfThumb key={a.id} a={a} /> : <FilePill key={a.id} a={a} />
      )}
    </div>
  );
}

// Renders one PDF page to a plain <canvas>, so once it's on screen it
// behaves exactly like a photo — pageable in the same swipe gallery, with
// no reliance on the browser's own (unreliable-on-mobile) PDF embed.
function PdfPageCanvas({ url, pageNumber, name }: { url: string; pageNumber: number; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const widthPx = Math.min((containerRef.current?.clientWidth || 600) * (window.devicePixelRatio || 1), 1600);
    setFailed(false);
    renderPdfPageToCanvas(url, pageNumber, canvas, widthPx).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [url, pageNumber]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-16">
        <FileText size={28} className="text-gray-300" />
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-[#2563EB] hover:underline">
          Не удалось показать страницу — открыть {name}
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} className="w-full h-auto rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

// Full-size, readable view of a single non-PDF attachment.
function LargeAttachment({ a }: { a: Attachment }) {
  if (isImage(a)) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block">
        <img src={a.url} alt={a.name} className="w-full max-h-[70vh] object-contain rounded-xl border border-gray-200 bg-gray-50" />
      </a>
    );
  }
  return <FilePill a={a} />;
}

type Slide = { key: string; a: Attachment; page?: number };

// A swipeable, one-page-at-a-time viewer for multi-page records (e.g. a
// photographed notebook, several worksheet pages). Every PDF page becomes
// its own slide — embedding a whole PDF in an iframe doesn't let you scroll
// or page through it on mobile Safari, so each page is rendered to a
// canvas instead and paged exactly like a photo. Native scroll-snap makes
// touch swiping work with no drag-gesture code of our own.
export function LargeAttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [index, setIndex] = useState(0);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    for (const a of attachments) {
      if (!isPdf(a)) continue;
      getPdfPageCount(a.url)
        .then((n) => {
          if (!cancelled) setPageCounts((prev) => (prev[a.id] === n ? prev : { ...prev, [a.id]: n }));
        })
        .catch(() => {
          if (!cancelled) setPageCounts((prev) => (prev[a.id] ? prev : { ...prev, [a.id]: 1 }));
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.map((a) => a.id).join(",")]);

  const slides: Slide[] = [];
  for (const a of attachments) {
    if (isPdf(a)) {
      const count = pageCounts[a.id] ?? 1;
      for (let p = 1; p <= count; p++) slides.push({ key: `${a.id}-p${p}`, a, page: p });
    } else {
      slides.push({ key: a.id, a });
    }
  }

  useEffect(() => {
    if (index > slides.length - 1) setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
  }

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  if (slides.length === 0) return null;
  if (slides.length === 1) {
    const s = slides[0];
    return s.page ? <PdfPageCanvas url={s.a.url} pageNumber={s.page} name={s.a.name} /> : <LargeAttachment a={s.a} />;
  }

  return (
    <div>
      <div className="relative">
        <div ref={trackRef} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar rounded-xl">
          {slides.map((s) => (
            <div key={s.key} className="w-full shrink-0 snap-center">
              {s.page ? <PdfPageCanvas url={s.a.url} pageNumber={s.page} name={s.a.name} /> : <LargeAttachment a={s.a} />}
            </div>
          ))}
        </div>
        {index > 0 && (
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Предыдущая страница"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-600 hover:bg-white hover:text-[#2563EB] transition"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {index < slides.length - 1 && (
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Следующая страница"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-600 hover:bg-white hover:text-[#2563EB] transition"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2.5">
        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goTo(i)}
              aria-label={`Страница ${i + 1}`}
              className={`rounded-full transition-all ${i === index ? "w-4 h-1.5 bg-[#2563EB]" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 tabular-nums">
          {index + 1} / {slides.length}
        </span>
      </div>
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
          {attachments.map((a) =>
            isImage(a) ? (
              <ImageThumb key={a.id} a={a} onRemove={() => remove(a.id)} />
            ) : isPdf(a) ? (
              <PdfThumb key={a.id} a={a} onRemove={() => remove(a.id)} />
            ) : (
              <FilePill key={a.id} a={a} onRemove={() => remove(a.id)} />
            )
          )}
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
