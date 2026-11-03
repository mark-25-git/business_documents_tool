"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

export function Sheet({ open, title, onClose, children, compact = false }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input, textarea, select")?.focus();
    document.body.style.overflow = "hidden";
    if (!compact) history.pushState({ ...history.state, megahLayer: titleId }, "");
    let ownsEntry = !compact;
    const back = () => { ownsEntry = false; close.current(); };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      if (ownsEntry && history.state?.megahLayer === titleId) history.back();
      dialog.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open, titleId, compact]);
  return <dialog ref={ref} aria-labelledby={titleId} className={compact ? "sheet compact-sheet" : "sheet"}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="sheet-inner"><header className="sheet-header"><h2 id={titleId}>{title}</h2>
      <Button variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></Button></header>
      <div className="sheet-content">{children}</div>
    </div>
  </dialog>;
}
