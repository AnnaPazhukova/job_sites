import type * as PdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Embedding a PDF in an <iframe> is unreliable on mobile Safari — the
// built-in viewer often shows only the first page with no way to scroll or
// page through the rest, because touch-scroll inside a nested iframe gets
// swallowed by the surrounding modal instead. Rendering each page to a
// plain <canvas> sidesteps that entirely: from there it's just an image,
// pageable with the same swipe gallery used for photos.
//
// pdfjs-dist (plus its worker) is a large dependency most page loads never
// touch, so it's loaded on demand here rather than imported at the top —
// Vite code-splits it into its own chunk, fetched only once a PDF is
// actually opened.
let pdfjsPromise: Promise<typeof PdfjsLib> | null = null;

function getPdfjs(): Promise<typeof PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

const docCache = new Map<string, Promise<PDFDocumentProxy>>();

async function loadDoc(url: string): Promise<PDFDocumentProxy> {
  let doc = docCache.get(url);
  if (!doc) {
    const lib = await getPdfjs();
    doc = lib.getDocument({ url }).promise;
    docCache.set(url, doc);
  }
  return doc;
}

export async function getPdfPageCount(url: string): Promise<number> {
  const doc = await loadDoc(url);
  return doc.numPages;
}

export async function renderPdfPageToCanvas(url: string, pageNumber: number, canvas: HTMLCanvasElement, targetWidthPx: number): Promise<void> {
  const doc = await loadDoc(url);
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / unscaled.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await page.render({ canvasContext: ctx, viewport }).promise;
}
