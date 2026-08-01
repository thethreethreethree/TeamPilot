"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  lifetimeValue: number | null;
  signupDate: string | null;
  lastSeenAt: string | null;
  conversationCount: number;
};

export default function CareCustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // Distinguish a fetch FAILURE (401/403/5xx/network) from a genuine empty index. Without this, a failure
  // left customers null → "No customers yet." — telling an agent whose session expired that the team has no
  // customers. Extracted to a retryable load(). (The error-dressed-as-no-data class, fixed 4th time here.)
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/care/agent/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    customers?.filter(
      (c) =>
        !search.trim() ||
        (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  return (
    <>
      <LearningHint
        as="block"
        category="C.A.R.E · Customers"
        title="Customer index"
        whatItIs="Every visitor who's ever messaged the team via C.A.R.E (widget or email) shows up here as a customer card — name, email, total conversation count, lifetime profile. Searchable by name or email. The card links into a specific conversation history view."
        why="Conversation history alone isn't enough — the team needs a customer-centric view that answers 'who is this person across all our conversations' without searching the inbox conversation by conversation. The customer index is that view: per §A11 patterns, never per-person verdicts."
        how="Browse to scan recent visitors. Search when you know the email or name. Click a card to see the lifetime conversation history for that customer."
        principle="Customer view is institutional memory of the relationship. The team that knows who they're talking to delivers better support."
      >
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-primary">Customers</h1>
          <p className="text-[11px] text-muted">
            Every visitor who&apos;s talked to us · §A11 patterns, not verdicts
          </p>
        </div>
        <div className="relative w-full md:w-72 md:max-w-md">
          <Search
            className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search customers by name or email"
            className="w-full bg-base border border-default rounded-md pl-7 pr-2 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-strong"
          />
        </div>
      </header>
      </LearningHint>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {!loading && loadError && (
          <div className="text-center py-16">
            <Users className="w-8 h-8 text-muted mx-auto mb-2" aria-hidden />
            <p className="text-sm text-primary mb-1">Couldn&apos;t load customers.</p>
            <p className="text-xs text-muted max-w-md mx-auto mb-3">
              This is a temporary error (your session may have expired), not a sign the customer index is
              empty.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs text-secondary underline hover:text-primary"
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-8 h-8 text-muted mx-auto mb-2" aria-hidden />
            <p className="text-sm text-primary mb-1">No customers yet.</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Once visitors share their email in chat, they show up here with
              their conversation history and lifetime profile.
            </p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <CustomerCard key={c.id} customer={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-4 hover:border-strong transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-ember-400/15 border border-ember-400/30 flex items-center justify-center text-brand text-sm font-bold shrink-0">
          {(customer.name ?? customer.email ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">
            {customer.name ?? "Anonymous"}
          </p>
          {customer.email && (
            <p className="text-xs text-secondary truncate">{customer.email}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
            <span>{customer.conversationCount} convos</span>
            {customer.lifetimeValue != null && (
              <span>· ${customer.lifetimeValue.toLocaleString()} LTV</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
