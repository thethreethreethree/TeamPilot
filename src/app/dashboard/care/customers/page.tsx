"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";

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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/customers");
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered =
    customers?.filter(
      (c) =>
        !search.trim() ||
        (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">Customers</h1>
          <p className="text-[11px] text-muted">
            Every visitor who&apos;s talked to us · §A11 patterns, not verdicts
          </p>
        </div>
        <div className="relative w-72">
          <Search
            className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-base border border-default rounded-md pl-7 pr-2 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-strong"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
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
        <div className="w-9 h-9 rounded-full bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-brand text-sm font-bold shrink-0">
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
