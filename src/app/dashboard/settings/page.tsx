"use client";

import TopBar from "@/components/layout/TopBar";
import { mockCompany } from "@/lib/mock-data";
import { Key, Save } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="Settings" subtitle="System Configuration" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-[#e8eaf6] mb-1">Company Profile</h2>
          <p className="text-xs text-[#5a6399] mb-5">Update your company details to improve AI context quality.</p>
          <div className="space-y-4">
            {[
              { label: "Company Name", value: mockCompany.name, placeholder: "Your company" },
              { label: "Industry", value: mockCompany.industry, placeholder: "Technology" },
              { label: "Stage", value: mockCompany.stage, placeholder: "Growth" },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium text-[#8895c4] mb-1.5">{field.label}</label>
                <input
                  defaultValue={field.value}
                  placeholder={field.placeholder}
                  className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[#5470ff]" />
            <h2 className="text-sm font-semibold text-[#e8eaf6]">AI Configuration</h2>
          </div>
          <p className="text-xs text-[#5a6399] mb-5">
            ExecOS uses Claude (Anthropic) for all AI features. Add your API key to activate live AI.
          </p>
          <div>
            <label className="block text-xs font-medium text-[#8895c4] mb-1.5">Anthropic API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3.5 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors font-mono"
            />
            <p className="text-xs text-[#5a6399] mt-2">
              Or set <code className="text-[#7a96ff] bg-[#5470ff]/10 px-1 rounded">ANTHROPIC_API_KEY</code> in your <code className="text-[#7a96ff] bg-[#5470ff]/10 px-1 rounded">.env.local</code> file.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
