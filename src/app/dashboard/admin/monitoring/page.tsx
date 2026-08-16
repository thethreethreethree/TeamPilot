"use client";

import { useEffect, useState } from "react";
import { Eye, Building2, Radio, ShieldAlert } from "lucide-react";

/**
 * Founder session-monitoring (0214 exemption). Vendor-super-admin only (gated by the
 * server layout + every API). Drill-down: monitorable companies → their sessions →
 * one session's transcript. Every read is audited server-side; the banner says so —
 * this is oversight, not a hidden backdoor (§3.4 honesty).
 */
type Company = { id: string; name: string; addedAt: string };
type Session = {
  id: string;
  agentName: string;
  clientLabel: string | null;
  context: string | null;
  status: string | null;
  startedAt: string | null;
  outcome: string | null;
};
type Segment = { speaker: string; text: string; seq: number };

export default function MonitoringPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading("companies");
    fetch("/api/admin/monitoring/companies")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setCompanies(d.companies ?? []))
      .catch(() => setError("Could not load companies."))
      .finally(() => setLoading(null));
  }, []);

  const openCompany = (c: Company) => {
    setCompany(c);
    setSession(null);
    setSegments([]);
    setSessions([]);
    setLoading("sessions");
    setError(null);
    fetch(`/api/admin/monitoring/sessions?companyId=${encodeURIComponent(c.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setError("Could not load sessions."))
      .finally(() => setLoading(null));
  };

  const openSession = (s: Session) => {
    setSession(s);
    setSegments([]);
    setLoading("session");
    setError(null);
    fetch(`/api/admin/monitoring/session/${encodeURIComponent(s.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setSegments(d.segments ?? []))
      .catch(() => setError("Could not load transcript."))
      .finally(() => setLoading(null));
  };

  return (
    <div className="min-h-screen bg-base px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Eye className="w-6 h-6 text-brand" aria-hidden />
          <h1 className="text-2xl font-bold text-primary">Session Monitoring</h1>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted mb-6">
          <ShieldAlert className="w-3.5 h-3.5 text-ember-400" aria-hidden />
          Founder oversight, scoped to existing companies. Every session you open is recorded
          to the monitoring audit log.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Companies */}
          <div className="glass-card p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
              <Building2 className="w-3.5 h-3.5" aria-hidden /> Companies
            </h2>
            {loading === "companies" ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : companies.length === 0 ? (
              <p className="text-xs text-muted">No monitorable companies.</p>
            ) : (
              <ul className="space-y-1">
                {companies.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => openCompany(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        company?.id === c.id
                          ? "bg-ember-400/10 text-primary"
                          : "text-secondary hover:bg-surface"
                      }`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sessions */}
          <div className="glass-card p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
              <Radio className="w-3.5 h-3.5" aria-hidden /> Sessions
            </h2>
            {!company ? (
              <p className="text-xs text-muted">Select a company.</p>
            ) : loading === "sessions" ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted">No sessions yet.</p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => openSession(s)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        session?.id === s.id
                          ? "bg-ember-400/10"
                          : "hover:bg-surface"
                      }`}
                    >
                      <span className="block text-sm text-primary">
                        {s.agentName}
                        {s.clientLabel ? ` · ${s.clientLabel}` : ""}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}
                        {s.status ? ` · ${s.status}` : ""}
                        {s.outcome ? ` · ${s.outcome}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Transcript */}
          <div className="glass-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
              Transcript
            </h2>
            {!session ? (
              <p className="text-xs text-muted">Select a session.</p>
            ) : loading === "session" ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : segments.length === 0 ? (
              <p className="text-xs text-muted">No transcript for this session.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {segments.map((seg) => (
                  <div key={seg.seq} className="text-sm">
                    <span
                      className={`text-[11px] font-semibold uppercase mr-2 ${
                        seg.speaker === "agent" ? "text-brand" : "text-secondary"
                      }`}
                    >
                      {seg.speaker}
                    </span>
                    <span className="text-primary">{seg.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
