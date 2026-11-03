"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string; }
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, placeholder, error, className, id, ...props }, ref) {
  const generated = React.useId();
  const fieldId = id || generated;
  return <div className={cn("field-wrap", className)}><div className={cn("floating-field textarea-field", error && "invalid")}>
    <textarea {...props} id={fieldId} ref={ref} placeholder=" " aria-invalid={!!error}
      aria-describedby={error ? `${fieldId}-help` : props["aria-describedby"]} />
    <label htmlFor={fieldId}>{label || placeholder || "Description"}</label>
  </div>{error && <p id={`${fieldId}-help`} className="field-error">{error}</p>}</div>;
});
