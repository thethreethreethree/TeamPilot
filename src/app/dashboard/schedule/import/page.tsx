"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Upload, ArrowRight, CheckCircle2, AlertTriangle, FileText, Table2, CalendarDays, Sparkles } from "lucide-react";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";
import { AssistantPanel } from "@/components/schedule/AssistantPanel";
import { to24h, normalizeCodeMap } from "@/lib/schedule/importTime";

/**
 * Schedule Management System — file-import screen (Phase 5, S3 + the VA presence-grid follow-up).
 *
 * Two input methods (the founder's real files come in both shapes):
 *   - CSV grid: staff down the side, dates across the top; the AI proposes dates + shift-code meanings to
 *     confirm, then preview → import. Wires /upload/{propose,preview,commit}.
 *   - VA schedule file (.docx/.pdf): a time-block × staff "On Duty" grid (a recurring weekday template).
 *     Upload the file + pick a target week; the server extracts + resolves it to dated shifts. Wires
 *     /upload/va/{preview,commit}.
 * Nothing is written until Import; an unmapped code / unparsed block blocks the import (never a guess).
 */

type ShiftTimes = { start: string; end: string };
type CodeVal = ShiftTimes | "off";
type Proposal = { headerCells: string[]; codes: string[]; headerDates: string[]; codeMap: Record<string, CodeVal>; notes: string };
type Preview = { staff: string[]; shifts: number; off: number; unknownCodes: string[]; willReplace?: number; replaceFrom?: string | null; replaceTo?: string | null; readyToCommit: boolean };
type VaPreview = { staff: string[]; entryCount: number; unparsedBlocks: string[]; willReplace?: number; replaceFrom?: string | null; replaceTo?: string | null; readyToCommit: boolean };
type Done = { staffCreated: number; shiftsCreated: number; assignmentsCreated: number; shiftsSuperseded?: number };

/** Read a File → base64 (no data: prefix). FileReader avoids the stack overflow of String.fromCharCode(...big). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function ScheduleImportPage() {
  const [mode, setMode] = useState<"csv" | "va">("csv");
  const [busy, setBusy] = useState<null | "propose" | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  // CSV mode
  const [csv, setCsv] = useState("");
  const [contextHint, setContextHint] = useState("");
  const [prop, setProp] = useState<Proposal | null>(null);
  const [dates, setDates] = useState("");
  const [map, setMap] = useState<Record<string, CodeVal>>({});
  const [preview, setPreview] = useState<Preview | null>(null);

  // VA mode
  const [vaFile, setVaFile] = useState<File | null>(null);
  const [vaWeek, setVaWeek] = useState("");
  const [vaPreview, setVaPreview] = useState<VaPreview | null>(null);

  // Extraction-integrity warnings from a staff×date PDF upload (surfaced so the manager checks the preview).
  const [gridWarnings, setGridWarnings] = useState<string[]>([]);
  // Set when a file uploaded to the "Schedule file" tab turned out to be a staff×date grid and we moved it
  // here (the CSV importer) automatically — so the founder isn't stranded on the wrong tab.
  const [movedNote, setMovedNote] = useState<string | null>(null);

  // Synchronous double-submit latch for the two COMMIT actions (they create staff + shifts). A busy-STATE
  // guard alone can double-fire: two clicks before the re-render disables the button both see busy === null.
  // A ref flips synchronously, so the second click is dropped — no duplicate import.
  const committingRef = useRef(false);

  const switchMode = (m: "csv" | "va") => {
    setMode(m);
    setError(null);
    setPreview(null);
    setVaPreview(null);
    setGridWarnings([]);
    setMovedNote(null);
  };

  // After a successful import, reset to a clean form so the manager can import another without a reload
  // (keeps the workflow flowing — see the "View the schedule" CTA that also follows a done import).
  const resetImport = () => {
    setDone(null); setError(null);
    setCsv(""); setContextHint(""); setProp(null); setDates(""); setMap({}); setPreview(null); setGridWarnings([]); setMovedNote(null);
    setVaFile(null); setVaWeek(""); setVaPreview(null);
  };

  // ---- CSV handlers ----
  const propose = async () => {
    if (!csv.trim()) return;
    setBusy("propose"); setError(null); setGridWarnings([]); // pasted CSV → any prior PDF-extraction warnings are stale
    try {
      const res = await fetch("/api/schedule/upload/propose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, contextHint: contextHint.trim() || undefined }),
      });
      if (!res.ok) { setError("Couldn't analyze the file. You can map the dates and codes by hand, or try again."); return; }
      const p: Proposal = await res.json();
      setProp(p); setDates(p.headerDates.join(", ")); setMap(normalizeCodeMap(p.codeMap ?? {})); setPreview(null);
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  // Upload a staff x date shift-code file (the "frendz" layout). The server extracts it to a CSV grid; then
  // the SAME confirm → preview → import flow runs. A .pdf comes back with dates already RESOLVED (skip straight
  // to mapping the codes); a .docx comes back as raw labels (headerDates empty) so the manager clicks Analyze
  // to resolve them — same as pasted CSV. No positional guessing on the docx path.
  const extractGridFile = async (file: File) => {
    setBusy("propose"); setError(null); setDone(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/schedule/upload/grid-pdf/extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, filename: file.name }),
      });
      if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Couldn't read that file."); return; }
      const d = (await res.json()) as { csv: string; headerDates: string[]; staff: string[]; codes: string[]; warnings?: string[] };
      setCsv(d.csv);
      setPreview(null);
      setGridWarnings(d.warnings ?? []);
      if (d.headerDates.length > 0) {
        // PDF: dates are resolved deterministically from the file. Ask the LLM to PROPOSE the shift-code times
        // too, so they come PRE-FILLED — the manager reviews + confirms rather than hand-mapping from scratch
        // (a wrong 1--10 = 1AM vs 1PM would create a wrong schedule, so the confirm stays, but it's fast now).
        setDates(d.headerDates.join(", "));
        let codeMap: Record<string, CodeVal> = {};
        let extra = "";
        try {
          const pr = await fetch("/api/schedule/upload/propose", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: d.csv }),
          });
          if (pr.ok) { const pj = await pr.json(); codeMap = normalizeCodeMap(pj.codeMap ?? {}); extra = pj.notes ? ` ${pj.notes}` : ""; }
        } catch { /* LLM unavailable — fall back to manual mapping, still fully functional */ }
        // Off-family codes are universal ("no shift", regardless of business) — map them deterministically so
        // they never need the founder's input. Times are still their call; "off" isn't.
        const OFF_CODES = new Set(["OFF", "REST", "RD", "DO", "RDO", "OFF DAY", "REST DAY", "DAY OFF"]);
        for (const code of d.codes) if (!codeMap[code] && OFF_CODES.has(code.toUpperCase())) codeMap[code] = "off";
        setMap(codeMap);
        const mapped = Object.keys(codeMap).length;
        setProp({
          headerCells: d.headerDates, codes: d.codes, headerDates: d.headerDates, codeMap,
          notes: `Read ${d.staff.length} staff and ${d.headerDates.length} dates from the file. I pre-filled ${mapped} of ${d.codes.length} shift-code times${mapped < d.codes.length ? " (fill the rest)" : ""} — check them, then Import.${extra}`,
        });
        // The debounced auto-preview effect (below) runs once prop+map are set, so the manager immediately SEES
        // the schedule the file creates and which codes still need a time — no explicit preview call needed.
      } else {
        // DOCX: raw labels — the CSV is loaded above; the manager clicks Analyze to resolve dates + codes.
        setProp(null); setDates("");
      }
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const headerDates = () => dates.split(",").map((d) => d.trim()).filter(Boolean);

  // Accepts explicit values so it can run right after extract+propose without waiting for the state setters
  // (auto-preview on upload); with no args it uses the current form state (the manual "Preview" button).
  const runPreview = async (over?: { csv?: string; headerDates?: string[]; codeMap?: Record<string, CodeVal> }) => {
    setBusy("preview"); setError(null);
    try {
      const res = await fetch("/api/schedule/upload/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: over?.csv ?? csv, headerDates: over?.headerDates ?? headerDates(), codeMap: normalizeCodeMap(over?.codeMap ?? map) }),
      });
      if (!res.ok) { setError("Couldn't build the preview. Check the dates and code map."); return; }
      setPreview(await res.json());
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  // Auto-(re)preview, debounced, whenever a confirm step is active and the dates/codes change — so the preview
  // + Import button stay live as the manager fills in codes (no hunting for a Preview button). runPreview only
  // sets `preview` (not map/dates/prop), so this cannot loop.
  useEffect(() => {
    if (!prop || !csv.trim()) return;
    const t = setTimeout(() => { void runPreview(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dates, prop, csv]);

  const commit = async () => {
    if (committingRef.current) return;
    committingRef.current = true;
    setBusy("commit"); setError(null);
    try {
      const res = await fetch("/api/schedule/upload/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, headerDates: headerDates(), codeMap: normalizeCodeMap(map) }),
      });
      if (res.status === 201) setDone(await res.json());
      else if (res.status === 403) setError("Only a manager can import a schedule.");
      else setError("Couldn't import. Nothing was changed.");
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); committingRef.current = false; }
  };

  // Editing the mapping/dates invalidates a prior preview — clear it so the "ready to import" state can't
  // reflect stale inputs (the commit re-parses server-side regardless, but a stale preview misleads).
  // No setPreview(null) here: the debounced auto-preview effect below re-runs the preview as codes change, so
  // the preview + Import button stay live (the manager doesn't have to hunt for Preview after filling a code).
  const setCode = (code: string, val: CodeVal) => setMap((m) => ({ ...m, [code]: val }));

  // ---- VA handlers ----
  const vaBody = async () => ({ fileBase64: await fileToBase64(vaFile!), filename: vaFile!.name, weekStart: vaWeek });

  const vaRunPreview = async () => {
    if (!vaFile || !vaWeek) return;
    setBusy("preview"); setError(null);
    try {
      const res = await fetch("/api/schedule/upload/va/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await vaBody()),
      });
      if (!res.ok) {
        // Auto-route: an "On Duty" grid wasn't found (422). The file may be a staff×date grid on the wrong
        // tab — try THAT importer on the same file and, if it reads, move the manager here rather than
        // stranding them behind an error telling them to switch tabs themselves.
        if (res.status === 422 && vaFile) {
          setMode("csv");
          setMovedNote("That file is a staff-by-date grid, not an 'On Duty' grid — I moved it to the right importer below.");
          await extractGridFile(vaFile);
          return;
        }
        setError((await res.json().catch(() => null))?.error ?? "Couldn't read that schedule file."); return;
      }
      setVaPreview(await res.json());
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const vaCommit = async () => {
    if (!vaFile || !vaWeek || committingRef.current) return;
    committingRef.current = true;
    setBusy("commit"); setError(null);
    try {
      const res = await fetch("/api/schedule/upload/va/commit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await vaBody()),
      });
      if (res.status === 201) setDone(await res.json());
      else if (res.status === 403) setError("Only a manager can import a schedule.");
      else setError((await res.json().catch(() => null))?.error ?? "Couldn't import. Nothing was changed.");
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); committingRef.current = false; }
  };

  const tab = (m: "csv" | "va", icon: React.ReactNode, label: string) => (
    <button type="button" onClick={() => switchMode(m)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === m ? "bg-brand text-black" : "bg-surface text-muted"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Upload className="w-6 h-6 text-brand" aria-hidden />
          <h1 className="text-xl font-bold text-primary">Import a Schedule</h1>
        </div>
        {/* The founder's flow: upload a file, then command the AI. The AI Assistant is reachable right here. */}
        <Link href="/dashboard/schedule/assistant"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-black shrink-0">
          <Sparkles className="w-4 h-4" aria-hidden /> AI Assistance
        </Link>
      </div>
      <p className="text-xs text-muted mb-4">Import a file, then tell the <span className="text-secondary">AI Assistant</span> how to adjust it. Nothing is saved until you press Import.</p>

      <div className="flex items-center gap-2 mb-5">
        {tab("csv", <Table2 className="w-3.5 h-3.5" aria-hidden />, "CSV grid")}
        {tab("va", <FileText className="w-3.5 h-3.5" aria-hidden />, "Schedule file (.docx/.pdf)")}
      </div>

      {done ? (
        <div className="glass-card p-5 border border-emerald-500/30 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
              <CheckCircle2 className="w-5 h-5" aria-hidden /> Imported
            </div>
            <p className="text-sm text-secondary">
              {done.staffCreated} new staff, {done.shiftsCreated} shifts, {done.assignmentsCreated} assignments
              {done.shiftsSuperseded ? `, replaced ${done.shiftsSuperseded} existing shift${done.shiftsSuperseded === 1 ? "" : "s"}` : ""}.
            </p>
          </div>
          {/* Workflow continuity (1.5.1 layer 3): after importing, the next action is to SEE it or to TELL the
              AI to adjust it (the founder's flow: upload a file, then command the AI). */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/schedule/assistant"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black">
              <Sparkles className="w-3.5 h-3.5" aria-hidden /> Adjust with the AI Assistant
            </Link>
            <Link href="/dashboard/schedule/grid"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden /> View the schedule
            </Link>
            <button type="button" onClick={resetImport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary">
              <Upload className="w-3.5 h-3.5" aria-hidden /> Import another
            </button>
          </div>
        </div>
      ) : mode === "csv" ? (
        <>
          {movedNote && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden /> {movedNote}
            </div>
          )}
          {/* Step 1: paste */}
          <div className="glass-card p-4 mb-4 space-y-3">
            <label className="text-sm font-semibold text-secondary">1. Paste the schedule (CSV)</label>
            <p className="text-[11px] text-muted">Staff down the side, dates across the top.</p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7}
              placeholder={"NAME,AUG 16,AUG 17,AUG 18\nALICE,6-3,6-3,OFF\nABRIL,OFF,2-11,2-11"}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-xs font-mono text-primary placeholder:text-muted" />
            <input value={contextHint} onChange={(e) => setContextHint(e.target.value)}
              placeholder="Context (optional), e.g. the title row: SCHEDULE AUGUST 16-30 2026"
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
            <button type="button" onClick={propose} disabled={!csv.trim() || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {busy === "propose" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
              Analyze
            </button>
            {/* Or upload a staff x date PDF/DOCX/XLSX grid — extracted to the same CSV flow. */}
            <div className="border-t border-white/10 pt-3">
              <div className="text-[11px] text-muted mb-1">Or upload a schedule <span className="text-secondary">.pdf</span> / <span className="text-secondary">.docx</span> / <span className="text-secondary">.xlsx</span> (staff down the side, dates across the top)</div>
              <input type="file" accept=".pdf,.docx,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void extractGridFile(f); }}
                className="block w-full text-xs text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
              <p className="text-[11px] text-muted mt-1">A PDF fills in the dates automatically; a DOCX/XLSX loads the grid — then click Analyze.</p>
            </div>
          </div>

          {/* Step 2: confirm dates + codes */}
          {prop && (
            <div className="glass-card p-4 mb-4 space-y-3">
              <label className="text-sm font-semibold text-secondary">2. Confirm the dates + shift codes</label>
              {prop.notes && <p className="text-[11px] text-muted italic">{prop.notes}</p>}
              {gridWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 space-y-1">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> Check the extraction
                  </p>
                  {gridWarnings.map((w, i) => <p key={i} className="text-[11px] text-amber-300/90">{w}</p>)}
                </div>
              )}
              <div>
                <div className="text-[11px] text-muted mb-1">Dates (one per column, ISO YYYY-MM-DD, comma separated)</div>
                <input value={dates} onChange={(e) => setDates(e.target.value)}
                  className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
              </div>
              <div className="space-y-2">
                {prop.codes.map((code) => {
                  const v = map[code];
                  const isOff = v === "off";
                  const t = v && v !== "off" ? v : { start: "", end: "" };
                  const unmapped = v === undefined;
                  return (
                    <div key={code} className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${unmapped ? "bg-ember-400/15 text-brand" : "bg-surface text-secondary"}`}>{code}</span>
                      <button type="button" onClick={() => setCode(code, "off")}
                        className={`text-[11px] px-2 py-1 rounded ${isOff ? "bg-brand text-black" : "bg-surface text-muted"}`}>day off</button>
                      <input type="time" value={to24h(t.start)} disabled={isOff} onChange={(e) => setCode(code, { start: e.target.value, end: t.end })}
                        aria-label={`${code} start`} className="rounded bg-surface border border-white/10 px-2 py-1 text-xs text-primary disabled:opacity-40" />
                      <span className="text-[11px] text-muted">to</span>
                      <input type="time" value={to24h(t.end)} disabled={isOff} onChange={(e) => setCode(code, { start: t.start, end: e.target.value })}
                        aria-label={`${code} end`} className="rounded bg-surface border border-white/10 px-2 py-1 text-xs text-primary disabled:opacity-40" />
                      {unmapped && <span className="text-[11px] text-brand">needs mapping</span>}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => void runPreview()} disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
                {busy === "preview" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
                Preview
              </button>
            </div>
          )}

          {/* Step 3: preview + import */}
          {preview && (
            <div className="glass-card p-4 mb-4 space-y-3">
              <label className="text-sm font-semibold text-secondary">3. Review + import</label>
              <p className="text-sm text-secondary">
                {preview.staff.length} staff · {preview.shifts} shift assignments · {preview.off} days off
              </p>
              {preview.unknownCodes.length > 0 && (
                <p className="flex items-center gap-2 text-xs text-brand">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  Map these codes before importing: {preview.unknownCodes.join(", ")}
                </p>
              )}
              {!!preview.willReplace && preview.willReplace > 0 && (
                <p className="flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  This replaces {preview.willReplace} existing shift{preview.willReplace === 1 ? "" : "s"}
                  {preview.replaceFrom && preview.replaceTo ? ` from ${preview.replaceFrom} to ${preview.replaceTo}` : ""} (the corrected week supersedes them — check the dates look right).
                </p>
              )}
              <button type="button" onClick={commit} disabled={!preview.readyToCommit || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {busy === "commit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
                Import schedule
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* VA: file + target week */}
          <div className="glass-card p-4 mb-4 space-y-3">
            <label className="text-sm font-semibold text-secondary">1. Upload the schedule file</label>
            <p className="text-[11px] text-muted">
              A .docx or .pdf with time-blocks down the side and staff across the top (an “On Duty” grid). The
              server reads it, coalesces each person’s on-duty blocks into shifts, and applies them to the week
              you pick.
            </p>
            <input type="file" accept=".docx,.pdf" onChange={(e) => { setVaFile(e.target.files?.[0] ?? null); setVaPreview(null); }}
              className="block w-full text-xs text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
            <div>
              <div className="text-[11px] text-muted mb-1">Target week (any day in it — the Monday is used)</div>
              <input type="date" value={vaWeek} onChange={(e) => { setVaWeek(e.target.value); setVaPreview(null); }}
                className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            </div>
            <button type="button" onClick={vaRunPreview} disabled={!vaFile || !vaWeek || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {busy === "preview" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
              Preview
            </button>
          </div>

          {vaPreview && (
            <div className="glass-card p-4 mb-4 space-y-3">
              <label className="text-sm font-semibold text-secondary">2. Review + import</label>
              <p className="text-sm text-secondary">
                {vaPreview.staff.length} staff · {vaPreview.entryCount} shift assignments across the week
              </p>
              {vaPreview.unparsedBlocks.length > 0 && (
                <p className="flex items-center gap-2 text-xs text-brand">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  These time blocks couldn’t be read — fix the file before importing: {vaPreview.unparsedBlocks.join(", ")}
                </p>
              )}
              {!!vaPreview.willReplace && vaPreview.willReplace > 0 && (
                <p className="flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  This replaces {vaPreview.willReplace} existing shift{vaPreview.willReplace === 1 ? "" : "s"}
                  {vaPreview.replaceFrom && vaPreview.replaceTo ? ` from ${vaPreview.replaceFrom} to ${vaPreview.replaceTo}` : ""} (the imported week supersedes them — check the dates look right).
                </p>
              )}
              <button type="button" onClick={vaCommit} disabled={!vaPreview.readyToCommit || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {busy === "commit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
                Import schedule
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}

      {/* The founder's flow: after (or instead of) uploading a file, tell the AI what to do — right here.
          Embedded so the manager never has to leave the import screen to command the assistant. */}
      <div className="glass-card p-4 mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-secondary mb-1">
          <Sparkles className="w-4 h-4 text-brand" aria-hidden /> Or just tell the AI Assistant
        </div>
        <p className="text-[11px] text-muted mb-3">
          Type an instruction in plain language and I&apos;ll propose the change for you to confirm — e.g.
          &ldquo;create a 06:00 to 15:00 shift on 2026-08-26 for 2 people&rdquo; or &ldquo;who&apos;s working this week?&rdquo;.
        </p>
        <AssistantPanel variant="embedded" />
      </div>
    </div>
  );
}
