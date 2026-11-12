"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, CheckCircle2, AlertCircle, Download, Eye, XCircle, Info, MoreHorizontal, Plus, RotateCcw, X } from "lucide-react";
import { useDocumentEditor } from "@/components/use-document-editor";
import { DocumentHome } from "@/components/document-home";
import { DocumentEditorForm } from "@/components/document-editor-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { documentLabels, money } from "@/lib/document-model";

const Preview = dynamic(() => import("@/components/document-preview-pane"), {
  ssr: false, loading: () => <div className="preview-loading" role="status"><div className="loading-dot" /><p>Loading PDF tools…</p></div>,
});
function Workspace() {
  const e = useDocumentEditor();
  const [wide, setWide] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const positions = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    window.scrollTo({ top: positions.current[e.screen] || 0, behavior: "instant" as ScrollBehavior });
    const scroll = () => { positions.current[e.screen] = window.scrollY; };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [e.screen]);
  React.useEffect(() => {
    document.title = e.screen === "home" ? "Documents · Megah" : `${e.fullNumber || "New document"} · Megah`;
  }, [e.screen, e.fullNumber]);
  const isHome = e.screen === "home";
  const isPreview = e.screen === "preview";
  const cancelled = ["CANCELLED", "INACTIVE"].includes(e.draft.status);
  const pending = !!e.busy || e.fetching;
  const canDownload = !!e.id && !e.dirty && !e.duplicate && !pending;
  const title = e.id ? e.fullNumber : `New ${documentLabels[e.draft.type].toLowerCase()}`;
  return <div className="app-shell">
    <main className={isHome ? "workspace home-workspace" : `workspace editor-workspace${isPreview ? " preview-workspace" : ""}`}>
      {e.feedback && <div className={`feedback feedback-${e.feedback.kind}`} role={e.feedback.kind === "error" ? "alert" : "status"}>
        {e.feedback.kind === "success" ? <CheckCircle2 size={20} /> : e.feedback.kind === "error" ? <XCircle size={20} /> : <Info size={20} />}
        <span>{e.feedback.text}</span><Button size="icon" variant="ghost" aria-label="Dismiss notification" onClick={() => e.setFeedback(null)}><X size={18} /></Button></div>}
      {e.fetching && <div role="status" className="fetch-status"><div className="loading-dot" />Opening document…</div>}
      <div hidden={!isHome}><DocumentHome editor={e} /></div>
      {!isHome && <>
        <header className="editor-heading toolbar">
          <Button variant="ghost" size="icon" aria-label={isPreview ? "Back to editor" : "Back to Documents"}
            onClick={() => isPreview ? e.navigate("edit", e.id) : e.navigate("home")} disabled={pending}><ChevronLeft size={23} /></Button>
          <h1>{isPreview ? "Preview" : title}</h1>
          {!isPreview && <div className="toolbar-actions">
            <Button variant="ghost" size="icon" aria-label="Download PDF" title={canDownload ? "Download PDF" : "Save the document to download the PDF"}
              disabled={!canDownload} busyLabel="…" onClick={async () => {
                try {
                  const { downloadDocumentPdf } = await import("@/components/document-pdf-output");
                  await downloadDocumentPdf(e.draft, e.fullNumber);
                } catch { e.setFeedback({ kind: "error", text: "PDF could not be downloaded. Please try again." }); }
              }}><Download size={20} /></Button>
            <Button variant="ghost" size="icon" aria-label="Preview PDF" title="Preview PDF" onClick={() => e.navigate("preview", e.id)}><Eye size={20} /></Button>
            <Button variant="ghost" size="icon" aria-label="More document actions" disabled={pending} onClick={() => setMore(true)}><MoreHorizontal size={22} /></Button>
          </div>}
        </header>
        {!isPreview && e.id && <p className="document-subtitle muted">{[documentLabels[e.draft.type], e.draft.billingName].filter(Boolean).join(" · ")}</p>}
        {e.loadError && <div className="inline-warning"><AlertCircle size={18} /><span>{e.loadError}</span><Button variant="outline" onClick={e.reload}>Retry</Button></div>}
        <div className={`editor-layout ${isPreview ? "preview-screen" : ""}`}>
          <div className="editor-form-pane" hidden={isPreview}><DocumentEditorForm editor={e} /></div>
          {(isPreview || wide) && <div className="preview-column"><Preview draft={e.draft} number={e.fullNumber} canDownload={canDownload} /></div>}
        </div>
        {!isPreview && <footer className="save-bar"><div className="save-bar-inner"><div className="save-total"><span>Total amount</span><strong>{money(e.totals.total)}</strong></div>
          <div className="save-actions">
            <Button type="submit" form="document-editor" busy={e.busy === "save"} busyLabel="Saving…" disabled={pending || (e.id !== null && !e.dirty)}>
              {e.id ? "Save changes" : "Save document"}</Button></div></div></footer>}
      </>}
    </main>
    <Sheet open={more} title="Document actions" onClose={() => setMore(false)} compact>
      <div className="form-stack"><Button variant="outline" onClick={() => { setMore(false); void e.startNew(); }}><Plus size={18} />Start a new document</Button>
        {e.id && <Button variant={cancelled ? "outline" : "destructive"} onClick={() => { setMore(false); void e.changeStatus(cancelled); }}>
          {cancelled ? <RotateCcw size={18} /> : <XCircle size={18} />}{cancelled ? "Recover document" : "Cancel document"}</Button>}
        <p className="field-hint">Cancelled documents stay in your records and can be recovered.</p></div>
    </Sheet>
    <Sheet open={!!e.confirmation} title={e.confirmation?.title || "Confirm action"} onClose={() => e.closeConfirmation(false)} compact>
      <p>{e.confirmation?.message}</p><div className="button-row"><Button variant="outline" onClick={() => e.closeConfirmation(false)}>Keep editing</Button>
        <Button variant="destructive" onClick={() => e.closeConfirmation(true)}>{e.confirmation?.confirmText}</Button></div>
    </Sheet>
  </div>;
}
export default function Home() {
  return <React.Suspense fallback={<div className="app-loading" role="status"><div className="loading-dot" /><p>Opening Megah…</p></div>}><Workspace /></React.Suspense>;
}
