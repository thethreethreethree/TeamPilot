import Link from "next/link";
import { Tag, Users, Zap, MessageCircle, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";
import { ExperienceModePanel } from "@/components/settings/ExperienceModePanel";

const CARDS = [
  {
    href: "/dashboard/care/settings/ai",
    label: "AI & Personality",
    body: "Make the AI yours: its name, tone, product knowledge, customer-assistance guidance, and the facts it answers from.",
    icon: Sparkles,
    hint: {
      title: "AI & Personality",
      whatItIs:
        "The one place you configure how the AI actually behaves — its persona (name, tone, length), what it knows about your product, how you want it to assist customers, and the adaptive knowledge it answers from.",
      why: "This is the single biggest lever on whether the AI helps or hurts. Everything else — appearance, routing, tags — is packaging around the substance the customer experiences, which is set here.",
      how: "Open it to name the AI, brief it on your product, set tone and length, write your assistance guidance, and upload knowledge documents.",
      principle: "Configure the substance before the packaging — the AI's judgment is what the customer feels.",
    },
  },
  {
    href: "/dashboard/care/settings/agents",
    label: "Agents",
    body: "Add teammates as support agents. Set skills, status, and routing rules.",
    icon: Users,
    hint: {
      title: "Agents",
      whatItIs:
        "Where you decide who on your team handles support, and how conversations get routed to them — their capacity and which channels they take.",
      why: "Routing is what turns a pile of incoming conversations into work that lands on the right person with room to take it. Get it wrong and either nobody owns a conversation or one person drowns.",
      how: "Open it to toggle teammates on as agents and set each one's max concurrent load and channels.",
      principle: "Coverage is a decision, not an accident — configure it deliberately.",
    },
  },
  {
    href: "/dashboard/care/settings/tags",
    label: "Tags",
    body: "Build your conversation taxonomy. Color, name, usage counts.",
    icon: Tag,
    hint: {
      title: "Tags",
      whatItIs:
        "Your conversation taxonomy — the named, colored labels agents apply to conversations so patterns become countable.",
      why: "Tags are how you later answer 'what are people actually contacting us about?' Without a shared vocabulary, every agent invents their own and the data can't be aggregated.",
      how: "Open it to create tags with a clear name and a color, before your team needs them.",
      principle: "A taxonomy defined up front is what makes retrospective analysis possible.",
    },
  },
  {
    href: "/dashboard/care/settings/shortcuts",
    label: "Shortcuts",
    body: "Canned response templates. Type / + shortcut in the composer to insert. Coach-graded for tone.",
    icon: Zap,
    hint: {
      title: "Shortcuts",
      whatItIs:
        "Reusable canned-response templates an agent inserts by typing / plus a keyword in the composer.",
      why: "They save agents from retyping the same answer, and keep the wording consistent across your team — while the Coach still grades tone so a template never goes out cold.",
      how: "Open it to build the responses your team sends most, each with a short trigger keyword.",
      principle: "Standardize the repetitive so agents can spend attention on what's actually unique.",
    },
  },
  {
    href: "/dashboard/care/settings/widget",
    label: "Widget",
    body: "Customer-facing chat widget: appearance, copy, embed snippet for white-label tenants.",
    icon: MessageCircle,
    hint: {
      title: "Widget",
      whatItIs:
        "The control surface for the customer-facing chat widget you embed on your own site — its look, its copy, the embed snippet, and the AI's product knowledge.",
      why: "This is the one C.A.R.E surface your customers actually see. Its appearance, its allowed origins, and what the AI knows about your product all decide whether the first response is on-brand and accurate.",
      how: "Open it to configure appearance, paste the embed snippet into your site, and brief the AI on your product.",
      principle: "The customer-facing surface deserves the most deliberate configuration — it speaks for you.",
    },
  },
  {
    href: "/dashboard/care/settings/account",
    label: "Account",
    body: "Subscription, billing, operating hours, security.",
    icon: SettingsIcon,
    hint: {
      title: "Account",
      whatItIs:
        "Your workspace-level settings — subscription, operating hours, and the security posture behind C.A.R.E.",
      why: "These are the org-wide facts that don't belong to any one conversation: what plan you're on, what response time you honestly advertise, and how your data is protected.",
      how: "Open it to review subscription and security, and to set operating hours once you have a measured baseline.",
      principle: "Advertise the service level you actually deliver, not the one you hope to.",
    },
  },
];

export default function CareSettingsLandingPage() {
  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">
          Configure how Care behaves for your team
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <LearningHint
                key={c.href}
                as="block"
                category="C.A.R.E · Settings"
                title={c.hint.title}
                whatItIs={c.hint.whatItIs}
                why={c.hint.why}
                how={c.hint.how}
                principle={c.hint.principle}
              >
                <Link
                  href={c.href}
                  className="block bg-white/[0.02] border border-default rounded-xl p-4 hover:border-strong transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-brand" aria-hidden />
                    <p className="text-sm font-semibold text-primary">{c.label}</p>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    {c.body}
                  </p>
                </Link>
              </LearningHint>
            );
          })}
        </div>

        {/* Experience Mode — the per-user Standard/Expert dial (0110), present in
            C.A.R.E per founder spec. The same preference used everywhere. */}
        <div className="mt-6">
          <ExperienceModePanel />
        </div>
      </div>
    </>
  );
}
