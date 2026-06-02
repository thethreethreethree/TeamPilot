"use client";

import { cn } from "@/lib/utils";
import React from "react";

/**
 * Shared form primitives (audit Tier 3 #24).
 *
 * <Field>      — label + control wrapper with consistent spacing
 * <Input>      — text input with consistent styling
 * <Textarea>   — auto-sized text area
 * <Select>     — native select with chevron styling
 *
 * These replace the duplicated `<style jsx global>` `.form-input` blocks that
 * were sitting in Tasks, Problems, Settings, and Team pages.
 */

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-[#8895c4]">
        {label}
        {required && (
          <span className="text-red-400" aria-label="required">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-[10px] text-[#5a6399]">{hint}</p>}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] " +
  "focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputBase, "resize-none leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(inputBase, "appearance-none pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
});
