"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { FileText, Loader2, MessageSquare, Search } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type FileHit = {
  id: string;
  title: string;
  description: string | null;
  classification_lane: "classified" | "casual";
  mime_type: string;
  created_at: string;
};

type ChatHit = {
  id: string;
  topic_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

type SupportHit = {
  id: string;
  conversation_id: string;
  body: string;
  author_type: "customer" | "ai" | "agent" | "system";
  created_at: string;
};

export default function SearchPage() {
  const companyName = useCompanyName();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileHit[]>([]);
  const [chats, setChats] = useState<ChatHit[]>([]);
  const [supports, setSupports] = useState<SupportHit[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length === 0) {
      setFiles([]);
      setChats([]);
      setSupports([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setFiles(data.files ?? []);
        setChats(data.chatMessages ?? []);
        setSupports(data.supportMessages ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250); // debounce — avoid hitting the API per keystroke
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <>
      <TopBar
        title="Search"
        subtitle={`${companyName ?? "Your team"} · Files + chats + support conversations`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full">
        <LearningHint
          as="block"
          category="Search · v1"
          title="Cross-surface search"
          whatItIs="A single search box across the team's three durable surfaces — files (title + description), team chat messages (body), and C.A.R.E support conversations (body, excluding internal notes). Results grouped by type so you can scan for the surface you're actually looking for."
          why="A discipline-driven system without honest retrieval becomes a discipline-driven graveyard. The team writes good messages and classifies good files — search is what makes that work pay off later. Per founder red-pen 2026-06-19."
          how="Type any term. Debounced 250ms so it doesn't hammer the API. Click any result to jump into context. The search respects access role — you only see what you'd see in the original surface."
          principle="Retrieval is what makes capture worth it. Without search, every chain becomes a write-only log."
        >
          <div className="relative mb-6">
            <Search
              className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files, chats, support conversations…"
              autoFocus
              className="w-full bg-surface border border-default rounded-lg pl-9 pr-3 py-3 text-base text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
            />
          </div>
        </LearningHint>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
            Searching…
          </div>
        )}

        {!loading && q.trim() && files.length === 0 && chats.length === 0 && supports.length === 0 && (
          <p className="text-center text-sm text-muted py-12">
            No results for &ldquo;{q}&rdquo;.
          </p>
        )}

        {files.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
              Files ({files.length})
            </h2>
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/dashboard/files`}
                    className="block rounded-md border border-default bg-white/[0.01] hover:border-strong p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {f.title}
                        </p>
                        {f.description && (
                          <p className="text-[11px] text-muted line-clamp-1">
                            {f.description}
                          </p>
                        )}
                        <p className="text-[10px] uppercase tracking-widest text-muted mt-0.5">
                          {f.classification_lane} · {new Date(f.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {chats.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
              Team chat messages ({chats.length})
            </h2>
            <ul className="space-y-1.5">
              {chats.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/dashboard/chats/${m.topic_id}#msg-${m.id}`}
                    className="block rounded-md border border-default bg-white/[0.01] hover:border-strong p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary line-clamp-2">
                          {m.body}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {supports.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
              C.A.R.E conversations ({supports.length})
            </h2>
            <ul className="space-y-1.5">
              {supports.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/dashboard/care?conv=${m.conversation_id}`}
                    className="block rounded-md border border-default bg-white/[0.01] hover:border-strong p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary line-clamp-2">
                          {m.body}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-muted mt-0.5">
                          {m.author_type} · {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
