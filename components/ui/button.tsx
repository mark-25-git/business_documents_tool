"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: "default" | "outline" | "ghost" | "destructive"; size?: "default" | "sm" | "lg" | "icon";
  busy?: boolean; busyLabel?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}
// Adapted from Still Balanced's ActionButton. Fill indicates activity, not a percentage.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", busy = false, busyLabel = "Processing…", className, children, disabled, onClick, type = "button", ...props }, ref
) {
  const [waiting, setWaiting] = React.useState(false);
  const inFlight = React.useRef(false);
  const pending = busy || waiting;
  return <button {...props} ref={ref} type={type} disabled={disabled || pending} aria-busy={pending || undefined}
    className={cn("button action-button", `button-${variant}`, `button-${size}`, className)}
    onClick={async event => {
      if (inFlight.current || pending) return;
      inFlight.current = true;
      try { const result = onClick?.(event);
        if (result && typeof result.then === "function") { setWaiting(true); await result; }
      } finally { inFlight.current = false; setWaiting(false); }
    }}>
    {pending && <span className="action-tint" aria-hidden="true" />}
    <span className="action-label">{pending ? busyLabel : children}</span>
  </button>;
});
