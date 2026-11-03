"use client";
import { useState } from "react";
import { ArrowRight, Plus, User } from "lucide-react";
import { Sheet } from "./ui/sheet";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import type { Customer } from "@/lib/types";
import type { DocumentEditor } from "./use-document-editor";

export function CustomerSheet({ open, onClose, editor: e }: { open: boolean; onClose: () => void; editor: DocumentEditor }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const results = e.customers.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));
  const select = (value: Customer) => { e.selectCustomer(value); onClose(); setQuery(""); setAdding(false); };
  return <Sheet open={open} title={adding ? "New customer" : "Choose customer"} onClose={onClose}>
    {adding ? <form className="form-stack" onSubmit={event => { event.preventDefault();
      if (customer.name.trim()) select({ ...customer, name: customer.name.trim(), id: `TEMP-${Date.now()}` });
    }}><p className="muted">Use these details for this document. The customer will be added when you save.</p>
      <Input label="Customer name" required value={customer.name} onChange={event => setCustomer({ ...customer, name: event.target.value })} autoFocus />
      <Input label="Phone" type="tel" autoComplete="tel" value={customer.phone} onChange={event => setCustomer({ ...customer, phone: event.target.value })} />
      <Input label="Email" type="email" autoComplete="email" value={customer.email} onChange={event => setCustomer({ ...customer, email: event.target.value })} />
      <Textarea label="Address" autoComplete="street-address" value={customer.address} onChange={event => setCustomer({ ...customer, address: event.target.value })} />
      <div className="button-row"><Button variant="outline" onClick={() => setAdding(false)}>Back to search</Button><Button type="submit">Use customer<ArrowRight size={16} /></Button></div>
    </form> : <div className="form-stack"><Input label="Search name or phone" type="search" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
      <Button variant="outline" onClick={() => { setCustomer({ name: query.trim(), phone: "", email: "", address: "" }); setAdding(true); }}><Plus size={18} />Add new customer</Button>
      {e.loading ? <p role="status">Loading customers…</p> : e.loadError ? <div role="alert"><p>{e.loadError}</p><Button variant="outline" onClick={e.reload}>Try again</Button></div>
        : results.length === 0 ? <p className="muted">No customers found. Try another name or add a new customer.</p>
        : <div className="customer-results">{results.map(c => <button type="button" key={c.id} className="customer-option" onClick={() => select(c)}>
          <span className="customer-avatar"><User size={18} /></span><span><strong>{c.name}</strong><small>{c.phone || "No phone"}{c.address && ` · ${c.address}`}</small></span><ArrowRight size={16} /></button>)}</div>}
    </div>}
  </Sheet>;
}
