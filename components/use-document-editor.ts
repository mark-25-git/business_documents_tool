"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import type { Customer, InvoiceDocument, LineItem } from "@/lib/types";
import { calculate, chooseCustomer, fingerprint, fromDocument, newDraft, splitNumber, toPayload, validateDraft, type Draft, type DraftErrors } from "@/lib/document-model";

type Feedback = { kind: "success" | "error" | "info"; text: string };
type Confirmation = { title: string; message: string; confirmText: string; resolve: (accepted: boolean) => void };
export function useDocumentEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const docParam = params.get("doc");
  const view = params.get("view");
  const screen = view === "preview" ? "preview" : view === "edit" || docParam ? "edit" : "home";
  const [draft, setDraft] = useState<Draft>(() => newDraft());
  const [baseline, setBaseline] = useState(() => fingerprint(newDraft()));
  const [id, setId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [documents, setDocuments] = useState<InvoiceDocument[]>([]);
  const [suggestions, setSuggestions] = useState<api.ItemSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState<"save" | "cancel" | "recover" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const locked = useRef(false);
  const fetchingId = useRef<string | null>(null);
  const draftGeneration = useRef(0);
  const dirty = fingerprint(draft) !== baseline;
  const totals = calculate(draft);
  const fullNumber = [draft.number.trim(), draft.suffix.trim()].filter(Boolean).join(" ");
  const duplicate = documents.some(doc => doc.id !== id && doc.docNumber.toLowerCase() === fullNumber.toLowerCase());
  const confirmAction = (title: string, message: string, confirmText: string) => new Promise<boolean>(resolve => setConfirmation({ title, message, confirmText, resolve }));
  const closeConfirmation = (accepted: boolean) => { confirmation?.resolve(accepted); setConfirmation(null); };

  const navigate = useCallback((next: "home" | "edit" | "preview", nextId?: string | null, replace = false) => {
    const query = new URLSearchParams();
    if (next !== "home") query.set("view", next);
    if (next !== "home" && nextId) query.set("doc", nextId);
    const url = query.size ? `/?${query}` : "/";
    router[replace ? "replace" : "push"](url, { scroll: false });
  }, [router]);

  const reload = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [loadedCustomers, loadedDocuments, loadedSuggestions] = await Promise.all([api.getCustomers(true), api.getDocuments(true), api.getItemSuggestions()]);
      setCustomers(loadedCustomers); setDocuments(loadedDocuments); setSuggestions(loadedSuggestions);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load your data. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setHasDraft(true);
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  };
  const selectCustomer = (customer: Customer) => {
    setDraft(previous => chooseCustomer(previous, customer));
    setHasDraft(true);
    setErrors(previous => { const next = { ...previous }; delete next.customer; return next; });
  };
  const openDocument = async (nextId: string) => {
    if (locked.current || fetchingId.current) return;
    if (nextId === id) { navigate("edit", id); return; }
    if (hasDraft && dirty && !(await confirmAction("Discard unsaved changes?", "Opening another document will replace your current edits.", "Discard and open"))) {
      navigate(screen, id, true); return;
    }
    draftGeneration.current++;
    fetchingId.current = nextId; setFetching(true); setFeedback(null);
    try {
      const doc = await api.getDocument(nextId);
      if (!doc) throw new Error("This document could not be opened. Retry from Documents.");
      const next = fromDocument(doc, customers);
      setDraft(next); setBaseline(fingerprint(next)); setId(doc.id); setHasDraft(true); setErrors({});
      navigate(docParam === nextId && screen === "preview" ? "preview" : "edit", doc.id, docParam === nextId);
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Could not open document." });
      navigate("home", null, true);
    } finally { fetchingId.current = null; setFetching(false); }
  };
  // URL links and browser Back use the same guarded document loader.
  useEffect(() => {
    if (!loading && docParam && docParam !== id && !fetchingId.current) void openDocument(docParam);
    // The document parameter is the navigation trigger; draft changes never reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docParam, loading]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if ((hasDraft && dirty) || locked.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [hasDraft, dirty]);
  useEffect(() => {
    if (screen === "edit" && Object.keys(errors).length) {
      const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [errors, screen]);
  // Numeric wheel guard covers dynamically mounted fields without stealing focus or zoom.
  useEffect(() => {
    const guard = (event: WheelEvent) => {
      const input = event.target;
      if (!event.ctrlKey && !event.metaKey && input instanceof HTMLInputElement && input.type === "number" &&
        input === document.activeElement && !input.disabled && !input.readOnly) event.preventDefault();
    };
    document.addEventListener("wheel", guard, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", guard, true);
  }, []);

  const startNew = async () => {
    if (locked.current || fetching) return;
    if (hasDraft && dirty && !(await confirmAction("Start a new document?", "Your current edits have not been saved. Discard them to start again.", "Discard and start"))) return;
    const next = newDraft();
    const generation = ++draftGeneration.current;
    setDraft(next); setBaseline(fingerprint(next)); setId(null); setHasDraft(true); setErrors({}); setFeedback(null);
    navigate("edit", null);
    // Apply the suggestion only if the person has not typed their own number.
    const number = await api.getNextDocNumber();
    if (number && generation === draftGeneration.current) {
      setDraft(previous => previous.number ? previous : { ...previous, number });
      setBaseline(fingerprint(newDraft(number)));
    }
  };
  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setDraft(previous => ({ ...previous, items: previous.items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...updates };
      next.amount = next.quantity * next.unitPrice;
      return next;
    }) }));
    setHasDraft(true);
    setErrors(previous => { const next = { ...previous }; delete next.items;
      for (const key of [`description-${index}`, `quantity-${index}`, `price-${index}`]) delete next[key];
      return next;
    });
  };
  const save = async () => {
    if (locked.current) return;
    const nextErrors = validateDraft(draft);
    if (duplicate) nextErrors.number = "This document number already exists.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      navigate("edit", id);
      setFeedback({ kind: "error", text: "Check the highlighted fields before saving." });
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    locked.current = true; setBusy("save"); setFeedback(null);
    try {
      let working = draft;
      if (working.customer!.id.startsWith("TEMP-")) {
        const ship = toPayload(working, false);
        const result = await api.createCustomer({ name: working.customer!.name, phone: working.customer!.phone, address: working.customer!.address,
          email: working.customer!.email, billingAddress: working.billingAddress, billingPhone: working.billingPhone,
          billingEmail: working.billingEmail, shippingName: ship.shippingName, shippingAddress: ship.shippingAddress, shippingPhone: ship.shippingPhone });
        if (!result.success || !result.id) throw new Error(result.error || "Could not save the new customer.");
        const customer = { ...working.customer!, id: result.id };
        working = { ...working, customer };
        setDraft(working); setCustomers(previous => [...previous, customer]);
      }
      const payload = toPayload(working, !!id);
      const result = id ? await api.updateDocument(id, payload) : await api.createDocument(payload);
      if (!result.success) throw new Error(result.error || "Could not save the document.");
      const savedId = result.docId || id;
      if (!savedId) throw new Error("The server did not return a document ID. Check Documents before retrying.");
      const saved = { ...working, ...splitNumber(result.docNumber || payload.docNumber || ""), status: payload.status, syncToMaster: false };
      setDraft(saved); setBaseline(fingerprint(saved)); setId(savedId);
      setDocuments(previous => [{ ...payload, id: savedId, docNumber: result.docNumber || payload.docNumber || "" }, ...previous.filter(doc => doc.id !== savedId)]);
      navigate(screen === "preview" ? "preview" : "edit", savedId, true);
      setFeedback({ kind: "success", text: id ? "Changes saved." : "Document saved. Your PDF is ready to download." });
    } catch (error) { setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Could not save. Your edits are still here." }); }
    finally { locked.current = false; setBusy(null); }
  };
  const changeStatus = async (recover: boolean) => {
    if (!id || locked.current) return;
    if (!(await confirmAction(recover ? "Recover this document?" : "Cancel this document?",
      recover ? "The document will become available again." : "The document stays in your records and can be recovered. Unsaved edits will be discarded.", recover ? "Recover document" : "Cancel document"))) return;
    locked.current = true; setBusy(recover ? "recover" : "cancel");
    try {
      const result = await (recover ? api.recoverDocument(id) : api.deleteDocument(id));
      if (!result.success) throw new Error(result.error || "The action could not be completed.");
      const doc = await api.getDocument(id);
      if (!doc) throw new Error("The status changed, but the latest document could not be loaded. Reopen it from Documents.");
      const next = fromDocument(doc, customers);
      setDraft(next); setBaseline(fingerprint(next));
      setDocuments(previous => previous.map(item => item.id === id ? { ...item, status: doc.status } : item));
      setFeedback({ kind: "success", text: recover ? "Document recovered." : "Document cancelled. You can recover it from More." });
    } catch (error) { setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Could not update status." }); }
    finally { locked.current = false; setBusy(null); }
  };
  return { draft, patch, setDraft, id, dirty, hasDraft, totals, fullNumber, duplicate, screen, customers, documents,
    suggestions, loading, loadError, fetching: fetching || (!!docParam && docParam !== id && loading), busy, feedback, setFeedback, errors, confirmation, closeConfirmation,
    reload, navigate, selectCustomer, openDocument, startNew, updateItem, save, changeStatus };
}
export type DocumentEditor = ReturnType<typeof useDocumentEditor>;
