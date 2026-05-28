"use client";

import { Activity, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!supabaseEnabled) {
      router.push("/dashboard");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
        router.push("/onboarding");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Route to onboarding if the user has no company yet.
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth.user!.id)
        .maybeSingle();

      router.push(profile?.company_id ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d16] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5470ff]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center shadow-glow">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">ExecOS</span>
        </div>

        <div className="glass-card p-8">
          <h1 className="text-xl font-bold text-white mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-[#5a6399] mb-6">
            {mode === "signin"
              ? "Sign in to your executive system"
              : "Set up your AI Executive Operating System"}
          </p>

          {!supabaseEnabled && (
            <div className="mb-5 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-200">
              Demo mode — Supabase not configured. Submitting will take you straight into the
              dashboard with mock data.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8895c4] mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@company.com"
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8895c4] mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-glow hover:shadow-none"
            >
              {loading
                ? "Please wait…"
                : mode === "signin"
                ? "Enter Command Center"
                : "Create account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-xs text-[#5a6399] mt-6">
            {mode === "signin" ? "No account? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setNotice("");
              }}
              className="text-[#7a96ff] hover:text-white transition-colors"
            >
              {mode === "signin" ? "Set up ExecOS" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
