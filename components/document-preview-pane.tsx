"use client";
import { useEffect, useMemo } from "react";
import { usePDF } from "@react-pdf/renderer";
import { Download, ExternalLink } from "lucide-react";
import { createPdfDocument, pdfFilename } from "./document-pdf-output";
import { PdfCanvas } from "./pdf-canvas";
import { type Draft } from "@/lib/document-model";

export default function DocumentPreviewPane({ draft, number, canDownload }: { draft: Draft; number: string; canDownload: boolean }) {
  const document = useMemo(() => createPdfDocument(draft, number), [draft, number]);
  const [instance, update] = usePDF({ document });
  useEffect(() => { update(document); }, [document, update]);
  return <section className="preview-pane" aria-label="Document preview">
    {instance.error ? <div className="empty-state" role="alert"><h3>Preview could not be generated</h3><p>{instance.error}</p><button className="button button-outline" onClick={() => update(document)}>Try again</button></div>
      : instance.loading || !instance.url ? <div className="preview-loading" role="status"><div className="loading-dot" /><p>Preparing preview…</p></div>
      : <><div className="preview-actions">
        <span className="document-meta">{number}</span>
        <div className="toolbar-actions">
          <a className="button button-ghost button-icon" aria-label="Open PDF in a new tab" title="Open PDF" href={instance.url} target="_blank" rel="noreferrer"><ExternalLink size={19} /></a>
          {canDownload && <a className="button button-ghost button-icon" aria-label="Download PDF" title="Download PDF" href={instance.url} download={pdfFilename(draft, number)}><Download size={20} /></a>}
        </div>
      </div><PdfCanvas url={instance.url} />
        {!canDownload && <p className="preview-notice">Save the document to download the PDF.</p>}</>}
  </section>;
}
