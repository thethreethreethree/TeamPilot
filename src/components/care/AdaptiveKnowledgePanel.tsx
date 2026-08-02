"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, FileText, RotateCcw, CheckCircle2 } from "lucide-react";

/**
 * Adaptive Customer Management System (ACMS) — client knowledge upload panel.
 *
 * Founder-locked (2026-07-25): ① KNOWLEDGE ONLY (facts the AI answers from, never
 * behavior — the prompt layer fences it), ② APPEND-ONLY versions, ③ upload a .md,
 * ④ customer-facing AI. Lives under "AI Personality" in widget settings.
 *
 * Talks to /api/care/agent/acms/documents (GET list+current, POST new version,
 * DELETE retract). The file is read client-side and its text posted as JSON — the
 * file-picker IS the upload; JSON transport matches the other care routes.
 */

type Version = {
  id: string;
  version: number;
  title: string;
  filename: string | null;
  byteSize: number;
  status: "active" | "retracted";
  createdAt: string;
};
type Current = { version: number; title: string; content: string } | null;

export function AdaptiveKnowledgePanel() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [current, setCurrent] = useState<Current>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Staged (picked but not yet uploaded) file.
  const [staged, setStaged] = useState<{ filename: string; content: string } | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/care/agent/acms/documents");
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(b?.error ?? `Couldn't load (HTTP ${res.status}).`);
        return;
      }
      const d = await res.json();
      setVersions(d.versions ?? []);
      setCurrent(d.current ?? null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    // Text formats read instantly in the browser (no server round-trip). Everything else (PDF, Word,
    // etc.) needs server-side extraction — founder 2026-07-30. maxChars = the 200k knowledge field cap.
    if (/\.(md|markdown|txt)$/i.test(file.name)) {
      if (file.size > 200000) {
        setError("File too large (200k character limit).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? "");
        if (!content.trim()) {
          setError("That file is empty.");
          return;
        }
        setStaged({ filename: file.name, content });
      };
      reader.onerror = () => setError("Couldn't read that file.");
      reader.readAsText(file);
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("File too large (4 MB limit).");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("maxChars", "200000");
      const res = await fetch("/api/care/agent/acms/extract", { method: "POST", body: fd });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? "Couldn't read that file.");
        return;
      }
      const content = String(d?.text ?? "");
      if (!content.trim()) {
        setError("No readable text was found in that document.");
        return;
      }
      setStaged({ filename: file.name, content });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!staged) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/care/agent/acms/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: staged.filename.replace(/\.[a-z0-9]+$/i, ""),
          filename: staged.filename,
          content: staged.content,
        }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) {
        setError(b?.error ?? `Upload failed (HTTP ${res.status}).`);
        return;
      }
      setStaged(null);
      if (fileRef.current) fileRef.current.value = "";
      setFlash("Knowledge updated — your AI now answers from this version.");
      window.setTimeout(() => setFlash(null), 4000);
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function retract() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/care/agent/acms/documents", {
        method: "DELETE",
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) {
        setError(b?.error ?? `Couldn't turn off (HTTP ${res.status}).`);
        return;
      }
      setFlash("Knowledge turned off — your AI now uses only its base setup.");
      window.setTimeout(() => setFlash(null), 4000);
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-default bg-base/40 p-5">
      <h3 className="text-sm font-semibold text-primary">
        Adaptive Customer Management
      </h3>
      <p className="mt-1 text-xs text-muted leading-relaxed max-w-2xl">
        Upload a document (<span className="font-mono">PDF, Word, .txt, .md, .rtf, .odt, .epub, .html</span>)
        of your own knowledge — services, hours, pricing, policies, FAQs — and your AI will
        answer customers from it. Your AI treats this as{" "}
        <b className="text-secondary">facts to answer from, not as instructions</b>,
        so it adds what your AI knows without taking over how it behaves — its
        honesty and its handoff to a human stay in place. Each upload is a new version.
      </p>

      {flash && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
          {flash}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-3 text-xs text-red-700 dark:text-red-300 border border-red-500/30 bg-red-500/5 rounded-md px-2.5 py-2"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-xs text-muted flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </p>
      ) : (
        <>
          {/* Current active knowledge */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest text-muted font-bold">
              Current knowledge
            </p>
            {current ? (
              <div className="mt-2 rounded-md border border-default bg-base p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand" aria-hidden />
                    {current.title}{" "}
                    <span className="text-muted font-mono">v{current.version}</span>
                  </span>
                  <button
                    type="button"
                    onClick={retract}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-300 hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden /> Turn off
                  </button>
                </div>
                <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] text-secondary font-mono leading-relaxed">
                  {current.content.slice(0, 2000)}
                  {current.content.length > 2000 ? "\n… (truncated)" : ""}
                </pre>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">
                No knowledge uploaded yet — your AI uses only its base setup.
              </p>
            )}
          </div>

          {/* Upload a new version */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest text-muted font-bold">
              {current ? "Upload a new version" : "Upload knowledge"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".md,.markdown,.txt,.html,.htm,.rtf,.docx,.odt,.epub,.pdf"
                onChange={pickFile}
                className="block text-xs text-secondary file:mr-3 file:rounded-md file:border file:border-default file:bg-base file:px-3 file:py-1.5 file:text-xs file:text-primary hover:file:border-strong"
              />
              {staged && (
                <button
                  type="button"
                  onClick={upload}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand text-[#09090B] px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="w-3.5 h-3.5" aria-hidden />
                  )}
                  Upload {staged.filename}
                </button>
              )}
            </div>
          </div>

          {/* Version history */}
          {versions.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-widest text-muted font-bold">
                History ({versions.length})
              </p>
              <ul className="mt-2 space-y-1">
                {versions.slice(0, 12).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 text-[11px] text-secondary"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-muted">v{v.version}</span>
                      <span className="truncate">{v.title}</span>
                      {v.status === "retracted" && (
                        <span className="text-red-700 dark:text-red-300">
                          (turned off)
                        </span>
                      )}
                    </span>
                    <span className="text-muted font-mono shrink-0">
                      {/* Local YYYY-MM-DD (en-CA) — NOT toISOString().slice(0,10), which shows the UTC date
                          and reads a day ahead for an evening edit west of UTC. Matches the toLocaleDateString
                          convention the rest of the UI uses (FileCard, LiveCoachingPanel; see chats/utils.ts). */}
                      {new Date(v.createdAt).toLocaleDateString("en-CA")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
