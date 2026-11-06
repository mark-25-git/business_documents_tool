"use client";
import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
export function Select({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId();
  const fieldId = id || generated;
  return <div className="field-wrap"><div className="floating-field select-field">
    <select {...props} id={fieldId}>{children}</select><label htmlFor={fieldId}>{label}</label><ChevronDown size={17} aria-hidden="true" />
  </div></div>;
}
