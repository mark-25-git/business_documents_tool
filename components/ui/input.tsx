"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; hint?: string; }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ label, placeholder, error, hint, className, id, ...props }, ref) {
  const generated = React.useId();
  const fieldId = id || generated;
  return <div className={cn("field-wrap", className)}>
    <div className={cn("floating-field", error && "invalid", props.disabled && "field-disabled")}>
      <input {...props} id={fieldId} ref={ref} placeholder=" " aria-invalid={!!error || props["aria-invalid"]}
        aria-describedby={error || hint ? `${fieldId}-help` : props["aria-describedby"]} />
      <label htmlFor={fieldId}>{label || placeholder || "Value"}</label>
    </div>
    {(error || hint) && <p id={`${fieldId}-help`} className={error ? "field-error" : "field-hint"}>{error || hint}</p>}
  </div>;
});
