"use client";

import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In production this would authenticate — for MVP, redirect to dashboard
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0c0d16] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5470ff]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center shadow-glow">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">ExecOS</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-[#5a6399] mb-6">Sign in to your executive system</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8895c4] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@company.com"
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8895c4] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold py-2.5 rounded-lg transition-colors shadow-glow hover:shadow-none"
            >
              Enter Command Center
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-[#5a6399] mt-6">
            No account?{" "}
            <Link href="/onboarding" className="text-[#7a96ff] hover:text-white transition-colors">
              Set up ExecOS
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
