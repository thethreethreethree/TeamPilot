"use client";

import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { supabaseEnabled } from "@/lib/supabase/client";
import Modal from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/toast";
import {
  fetchTopics,
  createTopic,
  type ChatTopic,
  type ChatsMode,
} from "@/lib/data/chats";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-surface-raised text-active-text border border-[#5EC8E0]/30",
  closed: "bg-gold-400/15 text-accent-text border border-gold-400/40",
  archived: "bg-surface-raised text-muted border border-default",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return iso.slice(0, 10);
}

export default function TeamChatListPage() {
  const companyName = useCompanyName();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [mode, setMode] = useState<ChatsMode>("demo-fixtures");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [query, setQuery] = useState("");

  const refresh = async () => {
    setLoading(true);
    const res = await fetchTopics();
    setTopics(res.topics);
    setMode(res.mode);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreating(true);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return topics
      .filter((t) => (filter === "all" ? true : t.status === filter))
      .filter((t) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      });
  }, [topics, filter, query]);

  const openCount = topics.filter((t) => t.status === "open").length;
  const closedCount = topics.filter((t) => t.status === "closed").length;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Team Chat"
        subtitle={`${companyName} · Topic-based conversations with structured outcomes`}
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {mode === "demo-fixtures" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gold-400/5 border border-gold-400/20">
            <AlertTriangle
              className="w-4 h-4 text-accent-text mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs text-accent-text">
              <span className="font-medium">Demo mode.</span> Three example topics
              are loaded — including one closed conversation showing what a
              resolved topic looks like. Try opening one, sending a message, and
              pinning a useful exchange. Messages persist locally so you can
              come back and continue.
            </p>
          </div>
        )}

        {/* Stats + actions */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="flex gap-6">
            <Stat label="Open" value={openCount} tone="open" />
            <Stat label="Closed" value={closedCount} tone="closed" />
            <Stat label="Total" value={topics.length} tone="all" />
          </div>
          <button
            onClick={() => setCreating(true)}
            disabled={!supabaseEnabled && mode !== "demo-fixtures"}
            className="flex items-center gap-2 bg-crimson-500 hover:bg-crimson-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            New topic
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-surface border border-default rounded-lg p-1">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                  filter === f
                    ? "bg-crimson-500/15 text-brand"
                    : "text-muted hover:text-primary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface border border-default rounded-lg px-3 py-1.5 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics or tags…"
              className="bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none flex-1"
            />
          </div>
        </div>

        {/* Topic list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            Loading topics…
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-primary mb-2">No topics match.</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              {query
                ? "Try a different search or clear the filter."
                : "Create the first topic above. Topics are the conversation containers for any decision your team needs to talk through."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateTopicModal
          heldTopics={topics.filter((t) => t.closeDurability === "held")}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            toast.success("Topic created", "Opening the conversation…");
            router.push(`/dashboard/chats/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "open" | "closed" | "all";
}) {
  const color =
    tone === "open"
      ? "text-arc-300"
      : tone === "closed"
      ? "text-accent-text"
      : "text-primary";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TopicCard({ topic }: { topic: ChatTopic }) {
  return (
    <Link
      href={`/dashboard/chats/${topic.id}`}
      className="glass-card p-4 hover:border-crimson-500/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare
              className="w-3.5 h-3.5 text-brand flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-primary truncate group-hover:text-brand transition-colors">
              {topic.title}
            </p>
          </div>
          {topic.description && (
            <p className="text-xs text-muted leading-relaxed line-clamp-2">
              {topic.description}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
            STATUS_BADGE[topic.status]
          }`}
        >
          {topic.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted mt-3">
        <div className="flex items-center gap-3">
          <span>{topic.participantCount} participants</span>
          <span>·</span>
          <span>{topic.messageCount} messages</span>
        </div>
        <span>{formatRelative(topic.lastMessageAt ?? topic.createdAt)}</span>
      </div>
      {topic.closeDurability === "held" && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-accent-text">
          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          Resolution held
        </div>
      )}
      {topic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-muted bg-surface-raised px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

type SimilarMatch = { id: string; similarity: number; reason: string };

function CreateTopicModal({
  heldTopics,
  onClose,
  onCreated,
}: {
  /** Closed topics with durability="held" — eligible for similarity matching. */
  heldTopics: ChatTopic[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ─── Similarity matching (§3.6 make-learning-visible) ───────────
  //
  // Debounced 600ms after the user stops typing the title/description.
  // Sends both fields plus a slim catalog of held topics to /api/chat/similar
  // and renders any ≥70% matches as a callout above the form. The user
  // can read, click through to a held topic, or proceed if their new topic
  // is genuinely different — the System never blocks creation.
  //
  // We deliberately tolerate a small race: if the user submits fast, the
  // last fetch may still be in flight. That's fine — the user already
  // decided. Better than blocking on every keystroke.
  const [matches, setMatches] = useState<SimilarMatch[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const t = title.trim();
    if (t.length < 4 || heldTopics.length === 0) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setMatching(true);
      setMatchError(null);
      try {
        const res = await fetch("/api/chat/similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            newTopic: { title: t, description: description.trim() },
            candidates: heldTopics.map((h) => ({
              id: h.id,
              title: h.title,
              description: h.description,
              closeSummary: h.closeSummary,
            })),
          }),
        });
        const data = (await res.json()) as {
          matches?: SimilarMatch[];
          error?: string;
        };
        if (data.error && !res.ok) {
          setMatchError(data.error);
          setMatches([]);
        } else {
          setMatches(data.matches ?? []);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setMatchError(err instanceof Error ? err.message : "Lookup failed");
      } finally {
        setMatching(false);
      }
    }, 600);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [title, description, heldTopics, dismissed]);

  const submit = async () => {
    if (!title.trim()) {
      setError("Title required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Unified create: hits Supabase in live mode, localStorage in demo.
      // RLS validates company_id == auth_company_id() server-side.
      const created = await createTopic({
        title: title.trim(),
        description: description.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New team chat topic" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          A topic is a conversation container. Pick one specific decision or
          subject — &quot;Tracking Q3 financial growth,&quot; &quot;Payment gateway root
          cause,&quot; &quot;Hiring the senior engineering role.&quot; Narrower topics produce
          sharper conversations.
        </p>

        {/* §3.6 make-learning-visible: when the new topic resembles a past
            held resolution, surface it. The user decides whether their
            topic is genuinely new or worth folding into the prior one. */}
        {matches.length > 0 && !dismissed && (
          <SimilarHeldTopicsCallout
            matches={matches}
            heldTopics={heldTopics}
            onDismiss={() => setDismissed(true)}
          />
        )}
        {matching && matches.length === 0 && title.trim().length >= 4 && (
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Checking whether the team has solved something like this before…
          </div>
        )}
        {matchError && (
          <p className="text-[10px] text-red-400">
            Similarity check failed: {matchError}
          </p>
        )}

        <Field label="Topic title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tracking Q3 financial growth"
            autoFocus
          />
        </Field>
        <Field label="Description (optional)">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this conversation for? Who should be in it?"
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="finance, Q3, board"
          />
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            You become the topic admin
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-crimson-500 hover:bg-crimson-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create topic"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Similar-held-topics callout ───────────────────────────────
//
// Rendered above the new-topic form when /api/chat/similar finds prior
// held-durability topics ≥ 70% similar to what the user is typing.
//
// UI discipline (§3.3 guide-don't-overtake):
//  - Title is informational, not assertive ("might overlap", not "duplicate").
//  - Each match is a passive surface — click-through to read the prior
//    topic, not a "use this instead" button.
//  - Dismiss is one click. We do not nag.
//  - The user can always proceed with their new topic; we never block.

function SimilarHeldTopicsCallout({
  matches,
  heldTopics,
  onDismiss,
}: {
  matches: SimilarMatch[];
  heldTopics: ChatTopic[];
  onDismiss: () => void;
}) {
  const byId = new Map(heldTopics.map((t) => [t.id, t]));
  return (
    <div className="rounded-lg border border-arc-400/30 bg-arc-400/5 p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-arc-300" aria-hidden="true" />
          <p className="text-xs font-semibold text-primary">
            The team has resolved something similar before
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-[10px] text-muted hover:text-primary"
        >
          Dismiss
        </button>
      </div>
      <p className="text-[10px] text-muted mb-2.5 leading-relaxed">
        Worth a quick read before starting a new conversation — the prior
        resolution held. You may decide your topic is genuinely different,
        and that&apos;s fine.
      </p>
      <ul className="space-y-2">
        {matches.map((m) => {
          const t = byId.get(m.id);
          if (!t) return null;
          return (
            <li key={m.id}>
              <Link
                href={`/dashboard/chats/${t.id}`}
                target="_blank"
                className="block rounded-md border border-arc-400/30 bg-surface px-2.5 py-2 hover:border-arc-400/60 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2
                      className="w-3 h-3 text-accent-text flex-shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-primary truncate group-hover:text-brand transition-colors">
                      {t.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-arc-300 flex-shrink-0">
                    <span className="font-mono">
                      {Math.round(m.similarity * 100)}%
                    </span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </div>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">
                  {m.reason}
                </p>
                {t.closeSummary && (
                  <p className="text-[10px] text-accent-text/80 mt-1 italic leading-relaxed line-clamp-2">
                    What held: {t.closeSummary}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
