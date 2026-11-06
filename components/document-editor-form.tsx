"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, MoreHorizontal, Plus, Trash2, User } from "lucide-react";
import { Button } from "./ui/button";
import { Input, type InputProps } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select } from "./ui/select";
import { Sheet } from "./ui/sheet";
import { CustomerSheet } from "./customer-sheet";
import { documentLabels, emptyItem, money, type Draft } from "@/lib/document-model";
import type { DocumentType } from "@/lib/types";
import type { DocumentEditor } from "./use-document-editor";

function NumberField({ value, onValue, ...props }: Omit<InputProps, "value" | "onChange" | "type"> & { value: number; onValue: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (!focused.current || value !== lastEmitted.current) setText(String(value));
    lastEmitted.current = value;
  }, [value]);
  return <Input {...props} type="number" inputMode="decimal" value={text}
    onFocus={() => { focused.current = true; }}
    onChange={event => { setText(event.target.value); lastEmitted.current = event.target.value === "" ? 0 : Number(event.target.value); onValue(lastEmitted.current); }}
    onBlur={() => { focused.current = false; setText(String(value)); }} />;
}
function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-field"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}
function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section className="editor-section" id={id}><h2>{title}</h2>{children}</section>;
}
export function DocumentEditorForm({ editor: e }: { editor: DocumentEditor }) {
  const [customerOpen, setCustomerOpen] = useState(false);
  const [suggestionsFor, setSuggestionsFor] = useState<number | null>(null);
  const [itemActions, setItemActions] = useState<number | null>(null);
  const d = e.draft;
  const field = <K extends keyof Draft>(key: K) => (value: Draft[K]) => e.patch(key, value);
  const moveItem = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= d.items.length) return;

    const items = [...d.items];
    [items[index], items[destination]] = [items[destination], items[index]];
    e.patch("items", items);
    setSuggestionsFor(null);

    requestAnimationFrame(() => document.getElementById(`item-actions-${destination}`)?.focus());
  };
  const profileChanges = d.customer ? [
    ["Name", d.customer.name, d.billingName],
    ["Billing address", d.customer.billingAddress || d.customer.address, d.billingAddress],
    ["Billing phone", d.customer.billingPhone || d.customer.phone, d.billingPhone],
    ["Billing email", d.customer.billingEmail || d.customer.email, d.billingEmail],
    ["Shipping name", d.customer.shippingName || d.customer.name, d.differentShipping ? d.shippingName : d.billingName],
    ["Shipping address", d.customer.shippingAddress || d.customer.address, d.differentShipping ? d.shippingAddress : d.billingAddress],
    ["Shipping phone", d.customer.shippingPhone || d.customer.phone, d.differentShipping ? d.shippingPhone : d.billingPhone],
  ].filter(([, oldValue, nextValue]) => (oldValue || "") !== nextValue) : [];
  return <>
    <form id="document-editor" noValidate onSubmit={event => { event.preventDefault(); void e.save(); }}>
      <fieldset disabled={!!e.busy || e.fetching} className="editor-fields">
        <Section title="Document details">
          <Select label="Document type" value={d.type} onChange={event => field("type")(event.target.value as DocumentType)}>
            {Object.entries(documentLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          </Select>
          <div className="field-grid metadata-grid">
            <Input label="Document number" value={d.number} readOnly={!!e.id} error={e.errors.number || (e.duplicate ? "This number already exists." : undefined)}
              hint={!e.id ? "Leave empty to assign automatically." : undefined} onChange={event => field("number")(event.target.value)} />
            <Input label="Date" type="date" value={d.date} error={e.errors.date} onChange={event => field("date")(event.target.value)} />
          </div>
          <details className="disclosure"><summary>Revision details<ChevronDown size={17} /></summary><div className="disclosure-content">
            <Input label="Revision suffix" hint="For example: (rev01)" value={d.suffix} onChange={event => field("suffix")(event.target.value)} /></div></details>
        </Section>
        <Section title="Customer" id="customer-section">
          {d.customer ? <><div className="selected-customer"><span className="customer-avatar"><User size={20} /></span><div><strong>{d.customer.name}</strong>
            <small>{d.customer.id.startsWith("TEMP-") ? "New customer · added when you save" : "Details saved with this document"}</small></div>
            <Button variant="ghost" onClick={() => setCustomerOpen(true)}>Change</Button></div>
            <Input label="Billing name" value={d.billingName} error={e.errors.billingName} onChange={event => field("billingName")(event.target.value)} />
            <Textarea label="Billing address" autoComplete="street-address" value={d.billingAddress} onChange={event => field("billingAddress")(event.target.value)} />
            <div className="field-grid"><Input label="Phone" type="tel" autoComplete="tel" value={d.billingPhone} onChange={event => field("billingPhone")(event.target.value)} />
              <Input label="Email" type="email" autoComplete="email" value={d.billingEmail} onChange={event => field("billingEmail")(event.target.value)} /></div>
            <CheckField label="Show email on document" checked={d.showEmail} onChange={field("showEmail")} />
            <CheckField label="Use a different shipping address" checked={d.differentShipping} onChange={field("differentShipping")} />
            {d.differentShipping && <div className="form-stack inset-section"><h3>Shipping details</h3>
              <Input label="Recipient name" value={d.shippingName} onChange={event => field("shippingName")(event.target.value)} />
              <Textarea label="Shipping address" value={d.shippingAddress} onChange={event => field("shippingAddress")(event.target.value)} />
              <Input label="Recipient phone" type="tel" value={d.shippingPhone} onChange={event => field("shippingPhone")(event.target.value)} /></div>}
            {!d.customer.id.startsWith("TEMP-") && <details className="disclosure"><summary>Customer profile options<ChevronDown size={17} /></summary><div className="disclosure-content">
              <CheckField label="Also update the saved customer profile" checked={d.syncToMaster} onChange={field("syncToMaster")} />
              <p className="field-hint">Leave this off to change only this document.</p>
              {d.syncToMaster && <div className="profile-changes"><strong>Changes to the customer profile</strong>
                {profileChanges.length ? <ul>{profileChanges.map(([label, oldValue, value]) => <li key={label}><strong>{label}</strong><span><del>{oldValue || "Empty"}</del> → {value || "Empty"}</span></li>)}</ul> : <p>No profile details have changed.</p>}</div>}
            </div></details>}
          </> : <button type="button" className="choose-customer" id="choose-customer" aria-invalid={!!e.errors.customer}
            aria-describedby={e.errors.customer ? "customer-error" : undefined} onClick={() => setCustomerOpen(true)}>
            <span className="customer-avatar"><User size={22} /></span><span><strong>Choose a customer</strong><small>Search saved customers or add someone new</small></span><ChevronRight size={20} aria-hidden="true" /></button>}
          {e.errors.customer && <p id="customer-error" className="field-error">{e.errors.customer}</p>}
        </Section>
        <Section title="Items" id="items-section">
          {e.errors.items && <p className="field-error" role="alert">{e.errors.items}</p>}
          {d.items.map((item, index) => {
            const descriptionId = `description-${index}`;
            const suggestionsId = `saved-items-${index}`;
            const query = item.description.trim().toLowerCase();
            const suggestions = e.suggestions.filter(suggestion => {
              const description = suggestion.description.toLowerCase();
              return !/delivery|shipping/.test(description) && (!query || (description.includes(query) && description !== query));
            }).slice(0, 15);
            const showSuggestions = suggestionsFor === index && suggestions.length > 0;
            const closeSuggestions = () => {
              document.getElementById(descriptionId)?.focus();
              setSuggestionsFor(null);
            };
            return <div className="item-card" key={index}>
              <div className="item-heading">
                <h3>Item {index + 1}</h3>
                {d.items.length > 1 && <Button variant="ghost" size="icon" id={`item-actions-${index}`}
                  aria-label={`Actions for item ${index + 1}`} aria-haspopup="dialog" onClick={() => setItemActions(index)}><MoreHorizontal size={22} /></Button>}
              </div>
              <div className="item-description"
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsFor(null);
                }}
                onKeyDown={event => {
                  if (event.key === "Escape" && showSuggestions) {
                    event.preventDefault();
                    closeSuggestions();
                  }
                }}>
                <Textarea label="Description" id={descriptionId} value={item.description} error={e.errors[descriptionId]}
                  aria-controls={showSuggestions ? suggestionsId : undefined}
                  onFocus={() => setSuggestionsFor(index)}
                  onChange={event => {
                    e.updateItem(index, { description: event.target.value });
                    setSuggestionsFor(index);
                  }} />
                {showSuggestions && <ul className="item-suggestions" id={suggestionsId} aria-label="Saved items">
                  {suggestions.map(suggestion => <li key={suggestion.description}>
                    <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
                      e.updateItem(index, { description: suggestion.description, unitPrice: suggestion.price });
                      closeSuggestions();
                    }}>{suggestion.description}</button>
                  </li>)}
                </ul>}
              </div>
              <div className="field-grid"><NumberField label="Quantity" min="0.01" step="any" value={item.quantity} error={e.errors[`quantity-${index}`]}
                onValue={value => e.updateItem(index, { quantity: value })} />
                <NumberField label="Unit price (RM)" step="0.01" value={item.unitPrice} error={e.errors[`price-${index}`]}
                  onValue={value => e.updateItem(index, { unitPrice: value })} /></div>
              <div className="item-total"><span>{item.unitPrice < 0 ? "Discount amount" : "Amount"}</span><strong>{money(item.amount)}</strong></div>
            </div>;
          })}
          <Button variant="outline" className="add-item" onClick={() => {
            e.patch("items", [...d.items, emptyItem()]);
            requestAnimationFrame(() => document.getElementById(`description-${d.items.length}`)?.focus());
          }}><Plus size={18} />Add item</Button>
        </Section>
        <Section title="Charges">
          <h3>Delivery</h3><CheckField label="Free delivery" checked={d.freeDelivery} onChange={field("freeDelivery")} />
          {!d.freeDelivery && <NumberField label="Delivery fee (RM)" min="0" step="0.01" value={d.deliveryFee} error={e.errors.deliveryFee} onValue={field("deliveryFee")} />}
          <div className="section-divider" /><CheckField label="Charge tax" checked={d.taxEnabled} onChange={value => { e.patch("taxEnabled", value); if (!value) e.patch("taxManual", false); }} />
          {d.taxEnabled && <div className="form-stack">
            <Input label="Tax title" value={d.taxTitle} onChange={event => field("taxTitle")(event.target.value)} />
            <div className="field-grid"><NumberField label="Tax rate (%)" step="any" min="0" value={d.taxRate} onValue={value => { e.patch("taxRate", value); e.patch("taxManual", false); }} />
              <NumberField label="Tax amount (RM)" step="0.01" min="0" value={e.totals.tax} error={e.errors.tax} onValue={value => { e.patch("taxAmount", value); e.patch("taxManual", true); }} /></div>
            {d.taxManual && <button type="button" className="text-action" onClick={() => e.patch("taxManual", false)}>Use calculated tax</button>}
          </div>}
          <div className="totals"><div><span>Subtotal</span><span>{money(e.totals.subtotal)}</span></div>
            {d.freeDelivery ? <div><span>Delivery</span><span>Free</span></div> : e.totals.delivery !== 0 && <div><span>Delivery</span><span>{money(e.totals.delivery)}</span></div>}
            {d.taxEnabled && <div><span>{d.taxTitle}</span><span>{money(e.totals.tax)}</span></div>}
            <div className="grand-total"><strong>Total</strong><strong>{money(e.totals.total)}</strong></div></div>
        </Section>
      </fieldset>
    </form>
    {itemActions !== null && <Sheet open title={`Item ${itemActions + 1} actions`} onClose={() => setItemActions(null)} compact>
      <div className="item-action-list">
        {itemActions > 0 && <Button variant="ghost" onClick={() => { moveItem(itemActions, -1); setItemActions(null); }}><ArrowUp size={18} />Move up</Button>}
        {itemActions < d.items.length - 1 && <Button variant="ghost" onClick={() => { moveItem(itemActions, 1); setItemActions(null); }}><ArrowDown size={18} />Move down</Button>}
        <Button variant="ghost" className="remove-item-action" onClick={() => {
          e.patch("items", d.items.filter((_, index) => index !== itemActions));
          setSuggestionsFor(null);
          setItemActions(null);
          requestAnimationFrame(() => document.getElementById(`description-${Math.min(itemActions, d.items.length - 2)}`)?.focus());
        }}><Trash2 size={18} />Remove item</Button>
      </div>
    </Sheet>}
    <CustomerSheet open={customerOpen} onClose={() => setCustomerOpen(false)} editor={e} />
  </>;
}
