"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Button } from "./button";

type Message = { kind: "success" | "error" | "info"; text: string };
export function StatusToast({ message, loading, onDismiss }: { message: Message | null; loading: boolean; onDismiss: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!message || loading || message.kind === "error" || hovered || focused) return;
    const timer = window.setTimeout(onDismiss, Math.max(6000, message.text.length * 60));
    return () => window.clearTimeout(timer);
  }, [message, loading, hovered, focused, onDismiss]);
  if (!loading && !message) return null;
  const kind = loading ? "info" : message!.kind;
  return <div className={`feedback feedback-${kind}`}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {loading ? <div className="loading-dot" aria-hidden="true" /> : kind === "success" ? <CheckCircle2 size={20} aria-hidden="true" /> : kind === "error" ? <XCircle size={20} aria-hidden="true" /> : <Info size={20} aria-hidden="true" />}
    <span role={kind === "error" ? "alert" : "status"} aria-atomic="true">{loading ? "Opening document…" : message!.text}</span>
    {!loading && <Button size="icon" variant="ghost" aria-label="Dismiss notification" onClick={onDismiss}><X size={18} /></Button>}
  </div>;
}
