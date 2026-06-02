"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";

/**
 * Small "Export" dropdown that triggers download of the current entity in CSV
 * or JSON format. Calls /api/export/[entity]?format=...
 *
 * Disabled in demo mode — exports are about exfiltrating YOUR data, not
 * exfiltrating fixtures.
 */
export default function ExportMenu({
  entity,
  disabled,
  disabledReason,
}: {
  entity: "tasks" | "problems" | "resolutions" | "signals" | "events" | "dialogues";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const download = (format: "csv" | "json") => {
    setOpen(false);
    if (disabled) return;
    const url = `/api/export/${entity}?format=${format}`;
    // Use a transient anchor so the browser handles Content-Disposition correctly.
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(
      "Export started",
      `${entity}.${format} — check your downloads folder`
    );
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={disabled ? disabledReason ?? "Export disabled" : "Export"}
        className="flex items-center gap-1.5 text-xs text-[#8895c4] hover:text-white border border-[#252840] hover:border-[#3a3f5c] px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
        Export
      </button>
      {open && !disabled && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-30 w-32 bg-[#12141f] border border-[#252840] rounded-lg shadow-lg overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={() => download("csv")}
            className="w-full text-left text-xs text-[#e8eaf6] hover:bg-[#1a1d2e] px-3 py-2"
          >
            CSV
          </button>
          <button
            role="menuitem"
            onClick={() => download("json")}
            className="w-full text-left text-xs text-[#e8eaf6] hover:bg-[#1a1d2e] px-3 py-2"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
