"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { documentLabels, money } from "@/lib/document-model";
import type { DocumentEditor } from "./use-document-editor";

export function DocumentHome({ editor: e }: { editor: DocumentEditor }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("all");
  const documents = useMemo(() => e.documents.filter(doc => {
    const cancelled = ["CANCELLED", "INACTIVE"].includes(doc.status);
    return (filter === "all" || (filter === "cancelled" ? cancelled : !cancelled)) &&
      (type === "all" || doc.type === type) &&
      `${doc.docNumber} ${doc.customerName}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => b.date.localeCompare(a.date) || b.docNumber.localeCompare(a.docNumber)), [e.documents, query, filter, type]);
  return <div className="home-screen">
    <div className="home-heading"><h1>Documents</h1>
      <Button onClick={e.startNew} disabled={e.fetching || !!e.busy}><Plus size={18} />New document</Button></div>
    {e.hasDraft && <div className="resume-card"><div><strong>{e.dirty ? "Unsaved document" : "Last opened"}</strong>
      <p>{[e.fullNumber, e.draft.customer?.name].filter(Boolean).join(" · ") || "New document"}</p></div>
      <Button variant="outline" onClick={() => e.navigate("edit", e.id)} disabled={e.fetching || !!e.busy}>{e.dirty ? "Resume editing" : "Open document"}</Button></div>}
    <section className="document-library" aria-label="Document library">
      <div className="library-tools"><div className="search-field"><Search size={19} aria-hidden="true" />
        <Input label="Search documents" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <Select label="Document type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>
          {Object.entries(documentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
      <div className="library-filter"><div className="segmented" aria-label="Filter by status">
        {[["all", "All"], ["active", "Active"], ["cancelled", "Cancelled"]].map(([value, label]) => <button type="button" key={value}
          aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <div className="library-results">
          {!e.loading && !e.loadError && <span className="result-count" role="status">{documents.length} {documents.length === 1 ? "document" : "documents"}</span>}
          <Button variant="ghost" size="icon" aria-label="Refresh documents" busyLabel="Refreshing…" onClick={e.reload}><RefreshCw size={18} /></Button>
        </div></div>
      {e.loading ? <div className="empty-state" role="status"><div className="loading-dot" /><h2>Loading documents…</h2></div>
        : e.loadError ? <div className="empty-state" role="alert"><h2>Could not load documents</h2><p>{e.loadError}</p><Button variant="outline" onClick={e.reload}>Try again</Button></div>
        : documents.length === 0 ? <div className="empty-state"><h2>{query || filter !== "all" || type !== "all" ? "No matching documents" : "No documents yet"}</h2>
          <p>{query || filter !== "all" || type !== "all" ? "Try another search or change the filters." : "Create a document to start your register."}</p>
          {!query && filter === "all" && type === "all" && <Button onClick={e.startNew}><Plus size={18} />New document</Button>}</div>
        : <div className="document-list">
          <div className="document-columns" aria-hidden="true"><span>Document</span><span>Customer</span><span>Date · newest first</span><span>Status</span><span className="document-amount">Total (RM)</span></div>
          {documents.map(doc => {
            const cancelled = ["CANCELLED", "INACTIVE"].includes(doc.status);
            const status = cancelled ? "Cancelled" : doc.status.toLowerCase().replace(/^./, character => character.toUpperCase());
            const date = new Date(doc.date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
            return <button key={doc.id} className="document-row" type="button"
              disabled={e.fetching || !!e.busy} onClick={() => void e.openDocument(doc.id)}>
              <span className="document-main"><strong>{doc.docNumber}</strong><span className="document-meta">{documentLabels[doc.type] || doc.type}</span></span>
              <span className="document-customer">{doc.customerName}</span>
              <span className="document-date">{date}</span>
              <span className={`status-badge ${cancelled ? "cancelled" : ""}`}>{status}</span>
              <strong className="document-amount">{money(doc.totalAmount)}</strong>
              <ChevronRight className="row-arrow" size={18} aria-hidden="true" />
            </button>;
          })}
        </div>}
    </section>
  </div>;
}
