"use client";

import { useState } from "react";
import { Loader2, Upload, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Schedule Management System — file-import screen (Phase 5, S3). Paste a CSV schedule (staff x date grid),
 * the AI proposes the dates + shift-code meanings for you to CONFIRM, you preview exactly what will be
 * created, then import. Wires /upload/propose -> /upload/preview -> /upload/commit. Nothing is written until
 * you press Import, and an unmapped code blocks the import (never a silent/guessed shift).
 */

type ShiftTimes = { start: string; end: string };
type CodeVal = ShiftTimes | "off";
type Proposal = { headerCells: string[]; codes: string[]; headerDates: string[]; codeMap: Record<string, CodeVal>; notes: string };
type Preview = { staff: string[]; shifts: number; off: number; unknownCodes: string[]; readyToCommit: boolean };

export default function ScheduleImportPage() {
  const [csv, setCsv] = useState("");
  const [contextHint, setContextHint] = useState("");
  const [busy, setBusy] = useState<null | "propose" | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [prop, setProp] = useState<Proposal | null>(null);
  const [dates, setDates] = useState("");
  const [map, setMap] = useState<Record<string, CodeVal>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<{ staffCreated: number; shiftsCreated: number; assignmentsCreated: number } | null>(null);

  const propose = async () => {
    if (!csv.trim()) return;
    setBusy("propose");
    setError(null);
    try {
      const res = await fetch("/api/schedule/upload/propose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, contextHint: contextHint.trim() || undefined }),
      });
      if (!res.ok) { setError("Couldn't analyze the file. You can map the dates and codes by hand, or try again."); return; }
      const p: Proposal = await res.json();
      setProp(p);
      setDates(p.headerDates.join(", "));
      setMap(p.codeMap ?? {});
      setPreview(null);
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const headerDates = () => dates.split(",").map((d) => d.trim()).filter(Boolean);

  const runPreview = async () => {
    setBusy("preview");
    setError(null);
    try {
      const res = await fetch("/api/schedule/upload/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, headerDates: headerDates(), codeMap: map }),
      });
      if (!res.ok) { setError("Couldn't build the preview. Check the dates and code map."); return; }
      setPreview(await res.json());
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const commit = async () => {
    setBusy("commit");
    setError(null);
    try {
      const res = await fetch("/api/schedule/upload/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, headerDates: headerDates(), codeMap: map }),
      });
      if (res.status === 201) { setDone(await res.json()); }
      else if (res.status === 403) { setError("Only a manager can import a schedule."); }
      else { setError("Couldn't import. Nothing was changed."); }
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const setCode = (code: string, val: CodeVal) => setMap((m) => ({ ...m, [code]: val }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Import a Schedule</h1>
      </div>
      <p className="text-xs text-muted mb-5">
        Paste a CSV schedule (staff down the side, dates across the top). The AI proposes the dates and shift
        codes for you to confirm. Nothing is saved until you press Import.
      </p>

      {done ? (
        <div className="glass-card p-5 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
            <CheckCircle2 className="w-5 h-5" aria-hidden /> Imported
          </div>
          <p className="text-sm text-secondary">
            {done.staffCreated} new staff, {done.shiftsCreated} shifts, {done.assignmentsCreated} assignments.
          </p>
        </div>
      ) : (
        <>
          {/* Step 1: paste */}
          <div className="glass-card p-4 mb-4 space-y-3">
            <label className="text-sm font-semibold text-secondary">1. Paste the schedule (CSV)</label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={7}
              placeholder={"NAME,AUG 16,AUG 17,AUG 18\nALICE,6-3,6-3,OFF\nABRIL,OFF,2-11,2-11"}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-xs font-mono text-primary placeholder:text-muted"
            />
            <input
              value={contextHint}
              onChange={(e) => setContextHint(e.target.value)}
              placeholder="Context (optional), e.g. the title row: SCHEDULE AUGUST 16-30 2026"
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted"
            />
            <button type="button" onClick={propose} disabled={!csv.trim() || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {busy === "propose" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
              Analyze
            </button>
          </div>

          {/* Step 2: confirm dates + codes */}
          {prop && (
            <div className="glass-card p-4 mb-4 space-y-3">
              <label className="text-sm font-semibold text-secondary">2. Confirm the dates + shift codes</label>
              {prop.notes && <p className="text-[11px] text-muted italic">{prop.notes}</p>}
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
                      <input value={t.start} onChange={(e) => setCode(code, { start: e.target.value, end: t.end })}
                        placeholder="start HH:mm" className="w-24 rounded bg-surface border border-white/10 px-2 py-1 text-xs text-primary" />
                      <input value={t.end} onChange={(e) => setCode(code, { start: t.start, end: e.target.value })}
                        placeholder="end HH:mm" className="w-24 rounded bg-surface border border-white/10 px-2 py-1 text-xs text-primary" />
                      {unmapped && <span className="text-[11px] text-brand">needs mapping</span>}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={runPreview} disabled={busy !== null}
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
              <button type="button" onClick={commit} disabled={!preview.readyToCommit || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {busy === "commit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
                Import schedule
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
    </div>
  );
}
