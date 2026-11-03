"use client";
import { useMemo, useState } from "react";
import { ArrowRight, FileText, Plus, RefreshCw, Search, FilePlus2 } from "lucide-react";
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
    <div className="home-heading"><div><h1>Documents</h1><p className="muted">Everything you send, all in one place.</p></div>
      <Button onClick={e.startNew} disabled={e.fetching || !!e.busy}><Plus size={18} />New document</Button></div>
    {e.hasDraft && <div className="resume-card"><div><strong>{e.dirty ? "Your work is still here" : "Continue where you left off"}</strong>
      <p>{e.draft.customer?.name || "New document"}{e.fullNumber && ` · ${e.fullNumber}`}</p></div>
      <Button variant="outline" onClick={() => e.navigate("edit", e.id)}>Resume<ArrowRight size={16} /></Button></div>}
    <section className="document-library" aria-label="Document library">
      <div className="library-tools"><div className="search-field"><Search size={19} aria-hidden="true" />
        <Input label="Search documents" hint="By number or customer name" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <Select label="Document type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>
          {Object.entries(documentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
      <div className="library-filter"><div className="segmented" aria-label="Filter by status">
        {[["all", "All"], ["active", "Active"], ["cancelled", "Cancelled"]].map(([value, label]) => <button type="button" key={value}
          aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <Button variant="ghost" size="icon" aria-label="Refresh documents" busyLabel="Refreshing…" onClick={e.reload}><RefreshCw size={18} /></Button></div>
      {e.loading ? <div className="empty-state" role="status"><div className="loading-dot" /><h2>Loading your documents</h2><p>Getting the latest from Google Sheets.</p></div>
        : e.loadError ? <div className="empty-state" role="alert"><h2>Could not load documents</h2><p>{e.loadError}</p><Button variant="outline" onClick={e.reload}>Try again</Button></div>
        : documents.length === 0 ? <div className="empty-state"><FilePlus2 size={32} /><h2>{query || filter !== "all" || type !== "all" ? "No matching documents" : "Your first document starts here"}</h2>
          <p>{query || filter !== "all" || type !== "all" ? "Try another search or change the filters." : "Create an invoice, quotation, receipt, or delivery order."}</p>
          {!query && filter === "all" && type === "all" && <Button onClick={e.startNew}><Plus size={18} />New document</Button>}</div>
        : <><p className="result-count">{documents.length} {documents.length === 1 ? "document" : "documents"} · newest first</p>
          <div className="document-list">{documents.map(doc => <button key={doc.id} className="document-row" type="button"
            disabled={e.fetching || !!e.busy} onClick={() => void e.openDocument(doc.id)} aria-label={`Open ${doc.docNumber} for ${doc.customerName}`}>
            <span className="document-icon"><FileText size={21} /></span>
            <span className="document-main"><strong>{doc.docNumber}</strong><span className="document-customer">{doc.customerName}</span>
              <span className="document-meta">{documentLabels[doc.type] || doc.type} · {new Date(doc.date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span></span>
            <span className="document-aside"><strong>{money(doc.totalAmount)}</strong><span className={`status-badge ${["CANCELLED", "INACTIVE"].includes(doc.status) ? "cancelled" : ""}`}>{["CANCELLED", "INACTIVE"].includes(doc.status) ? "Cancelled" : doc.status.toLowerCase().replace(/^./, c => c.toUpperCase())}</span></span>
            <ArrowRight className="row-arrow" size={18} aria-hidden="true" /></button>)}</div></>}
    </section>
  </div>;
}
