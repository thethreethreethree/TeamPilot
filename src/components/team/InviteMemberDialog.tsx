"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Mail,
  Send,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";

/**
 * InviteMemberDialog — shared invite modal mounted in-place wherever
 * inviting a teammate is a natural action: the Team page, the chats
 * list, and inside an open chat topic. Used to be inlined only on the
 * Team page; the chat surfaces linked over to that page with `?new=1`
 * which yanked testers out of their conversation, which they (rightly)
 * called out as friction.
 *
 * After successful create, the dialog surfaces TWO deliver options:
 *   - "Send by email"  → mailto: with subject + body pre-filled. Opens
 *                        the user's default mail client. The simplest
 *                        actual deliverable path without setting up an
 *                        SMTP / Resend integration.
 *   - "Copy link"      → puts the invite URL on the clipboard for
 *                        sending via Slack / DM / whatever.
 *
 * Both honestly reflect the current capability: "we generate a code,
 * you deliver it however you can." Pretending the System sends email
 * when it doesn't would violate §5 honesty.
 */

const ROLES = ["CEO", "COO", "Lead", "Member"] as const;
type Role = (typeof ROLES)[number];

export function InviteMemberDialog({
  open,
  onClose,
  onInvited,
  companyName,
}: {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
  companyName?: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setRole("Member");
    setError("");
    setInviteUrl("");
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!email.includes("@")) {
      setError("Valid email required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed.");
      const url = `${window.location.origin}/invite/${data.code}`;
      setInviteUrl(url);
      onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // mailto: subject + body. Encoded as a raw string then encodeURIComponent
  // so newlines and spaces survive into the user's mail client.
  const mailto = (() => {
    if (!inviteUrl) return "";
    const subject = companyName
      ? `Join ${companyName} on ELOSTATE`
      : "You're invited to ELOSTATE";
    const body = [
      companyName
        ? `You've been invited to join ${companyName} on ELOSTATE as a ${role}.`
        : `You've been invited to ELOSTATE as a ${role}.`,
      "",
      `Accept here: ${inviteUrl}`,
      "",
      "The link will expire — please open it within the next two weeks.",
    ].join("\n");
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <Modal open={open} onClose={close} title="Invite member" size="md">
      {!inviteUrl ? (
        <div className="space-y-3" aria-busy={submitting}>
          <Field label="Email" required>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="teammate@company.com"
              autoFocus
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <p className="text-[11px] text-muted leading-relaxed">
            Email delivery is not auto-sent. After you create the invitation,
            you&apos;ll get a link you can send by email or copy. Existing
            members of {companyName ?? "your company"} can&apos;t be re-invited.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="text-xs text-muted hover:text-secondary px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create invitation"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-primary mb-2">
              Invitation created for{" "}
              <span className="font-semibold text-brand">{email}</span>. Pick a
              delivery path:
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={mailto}
                className="flex items-center gap-1.5 text-xs bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-3 py-2 rounded-lg transition-colors"
                title="Open in your mail client"
              >
                <Send className="w-3 h-3" aria-hidden />
                Send by email
              </a>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#C8232C]/30 hover:border-[#C8232C]/60 px-2.5 py-2 rounded-lg transition-colors"
                title="Copy invite link to clipboard"
              >
                <Copy className="w-3 h-3" aria-hidden />
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Mail className="w-3 h-3 text-muted flex-shrink-0" aria-hidden />
              <input
                value={inviteUrl}
                readOnly
                aria-label="Invite URL"
                className="flex-1 bg-surface border border-default rounded-md px-2 py-1.5 text-[10px] text-secondary font-mono"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            &ldquo;Send by email&rdquo; opens your default mail app with the
            invite pre-filled. If your machine has no mail handler set, use
            &ldquo;Copy link&rdquo; and send it however you normally would.
          </p>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="text-xs text-muted hover:text-secondary px-3 py-2"
            >
              Invite another
            </button>
            <button
              type="button"
              onClick={close}
              className="text-xs text-brand hover:text-primary px-3 py-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
