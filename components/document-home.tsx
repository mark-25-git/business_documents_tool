"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { documentLabels, money } from "@/lib/document-model";
import type { DocumentEditor } from "./use-document-editor";

export function DocumentHome({ editor: e }: { editor: DocumentEditor }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const documents = useMemo(() => e.documents.filter(doc =>
    (type === "all" || doc.type === type) &&
    `${doc.docNumber} ${doc.customerName}`.toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => b.date.localeCompare(a.date) || b.docNumber.localeCompare(a.docNumber)), [e.documents, query, type]);
  const resumeLabel = e.dirty ? "Resume editing" : "Open document";
  return <div className="home-screen">
    <header className="home-heading toolbar"><h1>Documents</h1>
      <div className="toolbar-actions">
        <Button variant="ghost" size="icon" aria-label="Refresh documents" title="Refresh documents" onClick={e.reload}><RefreshCw size={19} /></Button>
        <Button size="icon" aria-label="New document" title="New document" onClick={e.startNew} disabled={e.fetching || !!e.busy}><Plus size={23} /></Button>
      </div>
    </header>
    <section className="document-library" aria-label="Document library">
      <div className="library-tools"><div className="search-field"><Search size={19} aria-hidden="true" />
        <Input label="Search documents" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className={`library-filter${type !== "all" ? " filter-active" : ""}`}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <select aria-label="Filter by document type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>
            {Object.entries(documentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      </div>
      <div className="library-results">
        {!e.loading && !e.loadError && <span className="result-count" role="status">{documents.length} {documents.length === 1 ? "document" : "documents"}</span>}
        {e.hasDraft && <button type="button" className="resume-action" aria-label={resumeLabel} title={resumeLabel}
          onClick={() => e.navigate("edit", e.id)} disabled={e.fetching || !!e.busy}>{e.dirty ? "Resume draft" : "Last opened"}<ChevronRight size={15} /></button>}
      </div>
      {e.loading ? <div className="empty-state" role="status"><div className="loading-dot" /><h2>Loading documents…</h2></div>
        : e.loadError ? <div className="empty-state" role="alert"><h2>Could not load documents</h2><p>{e.loadError}</p><Button variant="outline" onClick={e.reload}>Try again</Button></div>
        : documents.length === 0 ? <div className="empty-state"><h2>{query || type !== "all" ? "No matching documents" : "No documents yet"}</h2>
          <p>{query || type !== "all" ? "Try another search or change the document type." : "Create a document to start your register."}</p>
          {!query && type === "all" && <Button onClick={e.startNew}><Plus size={18} />New document</Button>}</div>
        : <div className="document-list">
          <div className="document-columns" aria-hidden="true"><span>Document</span><span>Customer</span><span>Date · newest first</span><span className="document-amount">Total (RM)</span></div>
          {documents.map(doc => {
            const date = new Date(doc.date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
            return <button key={doc.id} className="document-row" type="button"
              disabled={e.fetching || !!e.busy} onClick={() => void e.openDocument(doc.id)}>
              <span className="document-customer">{doc.customerName}</span>
              <span className="document-main"><span>{doc.docNumber}</span><span className="document-meta">{documentLabels[doc.type] || doc.type}</span></span>
              <span className="document-date">{date}</span>
              <strong className="document-amount">{money(doc.totalAmount)}</strong>
              <ChevronRight className="row-arrow" size={18} aria-hidden="true" />
            </button>;
          })}
        </div>}
    </section>
  </div>;
}
