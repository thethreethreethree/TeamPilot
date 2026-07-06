"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { EnableNotificationsBanner } from "@/components/pwa/EnableNotificationsBanner";
import { PullToRefresh } from "@/components/pwa/PullToRefresh";
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
  type ChatScope,
} from "@/lib/data/chats";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchHotkey } from "@/components/ui/useSearchHotkey";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-surface-raised text-active-text border border-ember-400/30",
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
  // This SAME page renders both the Elostate chat (/dashboard/chats) and the
  // Sales Coach team chat (/dashboard/sales-coach/team-chat). The route
  // decides which scope it reads + creates into, keeping the two separate
  // (migration 0076).
  const pathname = usePathname();
  const chatScope: ChatScope = pathname?.startsWith("/dashboard/sales-coach")
    ? "sales_coach"
    : "elostate";

  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [mode, setMode] = useState<ChatsMode>("demo-fixtures");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchHotkey(searchInputRef);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchTopics(chatScope);
      setTopics(res.topics);
      setMode(res.mode);
      // F2 (§3.4, A14): a read error is surfaced honestly via the existing
      // loadError card — it is NOT rendered as the "Start your first
      // conversation" empty state. The code+message tells us the real cause.
      if (res.mode === "live-error") {
        setLoadError(
          res.error
            ? `Could not load topics — ${res.error}`
            : "Could not load topics (database error)."
        );
      }
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? `Could not load topics — ${e.message}`
          : "Could not load topics (network error)."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Mount-only initial load. `refresh` is redefined each render (reads only
    // stable setState setters), so depending on it would refetch every render;
    // subsequent refreshes are driven explicitly (create/delete handlers).
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <PullToRefresh onRefresh={refresh} />
      <TopBar
        title="Team Chat"
        subtitle={`${companyName} · Topic-based conversations with structured outcomes`}
      />

      <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-6 min-w-0">
        <EnableNotificationsBanner />

        {/* Stats + actions */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="flex gap-6">
            <LearningHint
              category="Chat · Activity"
              title="Open"
              whatItIs="The count of topics currently in the open state — conversations that haven't been closed with a captured resolution."
              why="Topic counts are the team's working-conversation surface. Different from C.A.R.E (customer conversations) — this is the internal team's reasoning surface. A team that NEVER closes topics is a team where conversations evaporate. A team that closes too quickly is a team that loses context."
              how="Open is the working pile. Periodically scan it for topics that have gone stale (no message in 7+ days) — those are candidates to either restart or close with a resolution capture."
              principle="Open topics are reasoning in progress. Stale opens are reasoning that quietly died."
            >
              <Stat label="Open" value={openCount} tone="open" />
            </LearningHint>
            <LearningHint
              category="Chat · Outcomes"
              title="Closed"
              whatItIs="The count of topics that have been closed via the structured Close Topic flow — meaning a summary (≥20 chars) was captured along with the topic's outcome."
              why="Every closed topic is a chunk of institutional memory. Six months from now when 'didn't we talk about X' comes up, the closed topic carries the answer. This count is the team's compounding playbook size."
              how="Browse Closed periodically to refresh memory on past decisions. The Knowledge surface aggregates these into a searchable corpus."
              principle="Closed is the team's reasoning crystallized into reusable form. The more reasoning closes durably, the less the team has to re-derive."
            >
              <Stat label="Closed" value={closedCount} tone="closed" />
            </LearningHint>
            <LearningHint
              category="Chat · Total"
              title="Total"
              whatItIs="Open + Closed. The all-time count of topics ever created on this tenant."
              why="The shape of this number tells you which mode the team operates in. A team with 50 total topics in a year is probably under-using the conversation discipline; a team with 5000 is probably over-fragmenting (every Slack message becoming a topic)."
              how="Don't optimize this number — optimize the ratio of Closed to Open. A high total with low Closed means lots of conversations evaporate without capture. A balanced ratio is the healthy shape."
              principle="The shape of the ratio matters more than the raw count. Aim for closure, not creation."
            >
              <Stat label="Total" value={topics.length} tone="all" />
            </LearningHint>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LearningHint
              category="Chat · Team"
              title="Invite member"
              whatItIs="Opens the invite dialog inline (without yanking you out of the chat surface). Generates a unique invite link tied to a specific email + role; the invitee clicks it, lands in the auth flow, and joins THIS company on accept."
              why="Most invite flows force a context shift — you leave whatever you were doing, navigate to a team page, fill the form, navigate back. The in-place dialog respects the user's flow: invite + return without losing position."
              how="Click. Type the teammate's email. Pick a role (CEO / COO / Admin / Member / Support agent — the role gates downstream access). Send. The invitee gets an email with the link. Track pending invites on /dashboard/team."
              principle="Context shifts add up. The inline dialog is structural anti-friction for a recurring action."
            >
              <button
                type="button"
                onClick={() => setInviting(true)}
                title="Invite a team member"
                className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-semibold px-3 py-2 rounded-lg transition-colors text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Invite member
              </button>
            </LearningHint>
            <LearningHint
              category="Chat · Create"
              title="New topic"
              whatItIs="Opens the create-topic modal. A topic in ELOSTATE has a title, a description, optional tags, and a set of participants. Once created, it becomes a threaded conversation space — every message threads, mentions notify, the Coach grades drafts on send."
              why="The unit of work in Team Chat is the topic, not the message. A topic carries the team's reasoning about ONE thing — a decision, a problem, a plan. Threading conversations into topics is how the team avoids the Slack failure mode where critical reasoning gets buried in #general."
              how="Click to draft. Title clearly (a future teammate will search this). Description tells participants what they're being added to. Pick tags so the topic is findable. Add participants — they'll get a notification on mount."
              principle="The topic boundary is what makes the conversation findable later. The 15 seconds you spend titling well saves the team finding-this-again later."
            >
              <button
                type="button"
                onClick={() => setCreating(true)}
                disabled={!supabaseEnabled && mode !== "demo-fixtures"}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                New topic
              </button>
            </LearningHint>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-surface border border-default rounded-lg p-1">
            {(["all", "open", "closed"] as const).map((f) => {
              const hint =
                f === "all"
                  ? {
                      whatItIs:
                        "Shows every topic regardless of status. The default landing view.",
                      why: "Useful when scanning or searching across both open and closed topics — e.g., 'did we discuss X' regardless of whether that discussion is still alive.",
                      how: "Start here when you don't yet know whether the conversation you're looking for is still open. Narrow via Open or Closed once you know.",
                    }
                  : f === "open"
                  ? {
                      whatItIs:
                        "Filters to topics currently in the open state — active reasoning surfaces.",
                      why: "When you want to know what the team is currently talking through, Open is the relevant lens. Hides the archived conversations that would otherwise add noise.",
                      how: "Operate from this filter for daily work. The topics here are where new context is landing.",
                      principle:
                        "Open is the team's working memory surface. Browse it consciously.",
                    }
                  : {
                      whatItIs:
                        "Filters to topics that have been closed with a captured outcome.",
                      why: "When you're looking for institutional memory (what was decided about X, what was the summary of last quarter's tradeoff), Closed is where it lives.",
                      how: "Use the search box alongside this filter to find specific closed conversations. The summary captured at close is searchable.",
                      principle:
                        "Closed is the playbook. Search it first before re-deriving.",
                    };
              return (
                <LearningHint
                  key={f}
                  category="Chat · Filter"
                  title={f.charAt(0).toUpperCase() + f.slice(1)}
                  whatItIs={hint.whatItIs}
                  why={hint.why}
                  how={hint.how}
                  principle={"principle" in hint ? hint.principle : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                      filter === f
                        ? "bg-ember-400/15 text-brand"
                        : "text-muted hover:text-primary"
                    }`}
                  >
                    {f}
                  </button>
                </LearningHint>
              );
            })}
          </div>
          <LearningHint
            as="block"
            category="Chat · Search"
            title="Search topics"
            whatItIs="Full-text search across topic titles, descriptions, and tags. Press '/' from anywhere on the page to focus this input."
            why="As the topic count grows, scrolling to find a specific conversation becomes hostile. The search lets you jump straight to a topic by any phrase you remember. The tag dimension matters most — tagging conversations consistently turns the whole archive into a navigable atlas."
            how="Try keywords from what you remember of the conversation: a customer name, a feature, a date range, a tag. Press '/' anywhere to instantly focus this field. Combine with the open/closed filter to narrow."
            principle="Search trumps memory. Building the habit of searching first compounds over months."
          >
          <div className="flex items-center gap-2 bg-surface border border-default rounded-lg px-3 py-1.5 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics or tags… ( / )"
              aria-label="Search topics or tags. Press slash to focus."
              className="bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none flex-1"
            />
          </div>
          </LearningHint>
        </div>

        {/* Topic list */}
        {loadError && !loading && (
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/[0.04] flex items-center gap-3">
            <p className="flex-1 text-xs text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 px-2.5 py-1 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            Loading topics…
          </div>
        ) : loadError ? null : filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-primary mb-2">
              {query ? "No topics match." : "Start your first conversation."}
            </p>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              {query
                ? "Try a different search or clear the filter."
                : "Topics are where your team talks through decisions. Use the composer above to open one — the AI Coach will help shape it into a clear ask, and Co-pilot will suggest next steps as the thread develops."}
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
      <InviteMemberDialog
        open={inviting}
        onClose={() => setInviting(false)}
        companyName={companyName}
      />
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
  // Create into the scope of the surface we're on (keeps Sales Coach and
  // Elostate topics separate, migration 0076).
  const chatScope: ChatScope = usePathname()?.startsWith(
    "/dashboard/sales-coach"
  )
    ? "sales_coach"
    : "elostate";

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
        scope: chatScope,
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
              className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
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
