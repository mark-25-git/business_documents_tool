"use client";
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";

// Serve the vendor worker unchanged: Next 14's SWC transforms break this module.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

// Draw the generated PDF itself; mobile browsers need no embedded PDF plugin.
export function PdfCanvas({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    setError(""); setDocument(null); setPage(1); setRendering(true);
    const task = pdfjs.getDocument({ url, useSystemFonts: true });
    task.promise.then(pdf => { if (!disposed) setDocument(pdf); }).catch(failure => {
      if (!disposed) console.error("PDF preview loading failed:", failure);
      if (!disposed) { setError("The embedded preview could not be displayed. Use Open PDF above."); setRendering(false); }
    });
    return () => { disposed = true; void task.destroy(); };
  }, [url]);
  useEffect(() => {
    if (!document || !width) return;
    let disposed = false;
    let task: ReturnType<PDFPageProxy["render"]> | undefined;
    setRendering(true); setError("");
    async function render() {
      try {
        const pdfPage = await document!.getPage(page);
        if (disposed || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: (width - 24) / base.width * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.current.width = Math.floor(viewport.width * ratio);
        canvas.current.height = Math.floor(viewport.height * ratio);
        canvas.current.style.width = `${viewport.width}px`;
        canvas.current.style.height = `${viewport.height}px`;
        task = pdfPage.render({ canvas: canvas.current, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
      } catch (failure) {
        if (!disposed) console.error("PDF preview drawing failed:", failure);
        if (!disposed) setError("The preview could not be drawn. Use Open PDF above.");
      } finally { if (!disposed) setRendering(false); }
    }
    void render();
    return () => { disposed = true; task?.cancel(); };
  }, [document, page, width, zoom]);
  return <div className="pdf-canvas-view">
    <div className="pdf-controls"><div>
      <Button variant="ghost" size="icon" aria-label="Previous PDF page" disabled={page <= 1 || rendering} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></Button>
      <span aria-live="polite">Page {page} of {document?.numPages || "…"}</span>
      <Button variant="ghost" size="icon" aria-label="Next PDF page" disabled={!document || page >= document.numPages || rendering} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></Button>
    </div><div>
      <Button variant="ghost" size="icon" aria-label="Zoom out PDF" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - .25))}><Minus size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label="Zoom in PDF" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + .25))}><Plus size={16} /></Button>
    </div></div>
    <div ref={container} className="pdf-canvas-scroll" aria-busy={rendering}>
      {rendering && <p className="pdf-rendering" role="status">Drawing page…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <canvas ref={canvas} role="img" aria-label={`PDF page ${page}`} />
    </div>
  </div>;
}
