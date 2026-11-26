"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";

/**
 * Settings → Sign-in codes (multi-factor sign-in, 2026-11-23). Add an authenticator app (scan the QR code, type a code
 * to confirm), see which are on, remove one. Once confirmed, every sign-in asks for a code after the password, and the
 * whole app — pages, API and database — waits for it.
 */
type Factor = { id: string; name: string; status: string; createdAt: string };

export function TwoFactorPanel() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/me/mfa", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { factors: Factor[] };
      setFactors(j.factors);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/me/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { factorId?: string; qr?: string; secret?: string; error?: string };
      if (!r.ok || !j.factorId || !j.qr || !j.secret) {
        setNote(j.error ?? "Couldn't start setup.");
        return;
      }
      setSetup({ factorId: j.factorId, qr: j.qr, secret: j.secret });
      setCode("");
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!setup) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/me/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factorId: setup.factorId, code }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setNote(j.error ?? "That code didn't match.");
        return;
      }
      setSetup(null);
      setNote("Sign-in codes are on. From now on, signing in asks for a code from this app.");
      await load();
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: Factor) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/me/mfa", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factorId: f.id }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; on?: boolean };
      if (!r.ok) {
        setNote(j.error ?? "Couldn't remove it.");
        return;
      }
      setNote(j.on ? "Removed. Your other authenticator still protects sign-in." : "Removed. Signing in no longer asks for a code.");
      await load();
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const verified = (factors ?? []).filter((f) => f.status === "verified");

  return (
    <section className="glass-card space-y-3 p-6" aria-label="Sign-in codes">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Sign-in codes</h2>
        {verified.length > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">On</span>}
      </div>
      <p className="text-xs text-muted">
        Add an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator…). Signing in then asks for the
        6-digit code it shows, so a stolen password alone can&apos;t open your account. The Chrome extension connects through
        the web sign-in, so it asks for the code there. The ELOSTATE mobile app can&apos;t ask for codes yet: while this is
        on, it will ask you to sign in on the web instead.
      </p>

      {failed ? (
        <p className="text-xs text-muted">Couldn&apos;t load your sign-in methods. Refresh to try again.</p>
      ) : factors === null ? (
        <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
      ) : (
        <>
          {verified.length > 0 && (
            <ul className="space-y-1.5">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-default px-3 py-2 text-sm">
                  <span className="text-primary">{f.name}</span>
                  <button type="button" disabled={busy} onClick={() => void remove(f)} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!setup ? (
            <button type="button" disabled={busy} onClick={() => void start()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {verified.length ? "Add another authenticator" : "Turn on sign-in codes"}
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-default p-3">
              <p className="text-xs text-secondary">1. Scan this with your authenticator app.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code to add ELOSTATE to an authenticator app" width={180} height={180} className="rounded bg-white p-2" />
              <p className="text-xs text-muted">Can&apos;t scan? Enter this key instead: <code className="select-all break-all text-primary">{setup.secret}</code></p>
              <label htmlFor="mfa-setup-code" className="block text-xs text-secondary">2. Type the 6-digit code it shows.</label>
              <div className="flex flex-wrap gap-2">
                <input id="mfa-setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                  className="w-32 rounded-lg border border-default bg-base px-3 py-2 text-center tabular-nums text-primary" />
                <button type="button" disabled={busy || code.replace(/\s/g, "").length !== 6} onClick={() => void confirm()}
                  className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">Confirm</button>
                <button type="button" disabled={busy} onClick={() => setSetup(null)} className="rounded-lg border border-default px-3 py-2 text-xs text-secondary">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
      {note && <p className="text-xs text-secondary" role="status">{note}</p>}
    </section>
  );
}
