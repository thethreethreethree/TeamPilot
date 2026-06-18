"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { FloatingMenu } from "@/components/ui/FloatingMenu";

/**
 * Small "Export" dropdown that triggers download of the current entity in CSV
 * or JSON format. Calls /api/export/[entity]?format=...
 *
 * Disabled in demo mode — exports are about exfiltrating YOUR data, not
 * exfiltrating fixtures.
 *
 * 2026-06-19 — migrated to FloatingMenu so the menu portals to body
 * (escapes the toolbar's overflow context) and is viewport-aware.
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const toast = useToast();

  const download = (format: "csv" | "json") => {
    setOpen(false);
    if (disabled) return;
    const url = `/api/export/${entity}?format=${format}`;
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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={disabled ? disabledReason ?? "Export disabled" : "Export"}
        className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
        Export
      </button>
      <FloatingMenu
        open={open && !disabled}
        anchorRef={triggerRef}
        placement="bottom-end"
        onClose={() => setOpen(false)}
        minWidth={128}
        zIndex={50}
        className="bg-surface border border-default rounded-lg shadow-lg overflow-hidden"
      >
        <div role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => download("csv")}
            className="w-full text-left text-xs text-primary hover:bg-surface-raised px-3 py-2"
          >
            CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => download("json")}
            className="w-full text-left text-xs text-primary hover:bg-surface-raised px-3 py-2"
          >
            JSON
          </button>
        </div>
      </FloatingMenu>
    </>
  );
}
