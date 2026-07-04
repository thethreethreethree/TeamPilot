import {
  MoreHorizontal,
  Share,
  ChevronDown,
  Bookmark,
  FolderClosed,
  Star,
  PlusSquare,
  SquarePen,
  Lock,
  ChevronLeft,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  MoreVertical,
  Smartphone,
  Download,
} from "lucide-react";
import Link from "next/link";

/**
 * InstallInstructions — iOS "Add to Home Screen" walkthrough card.
 *
 * Fills the gap InstallPrompt.tsx names in its own comment: Safari never
 * fires `beforeinstallprompt`, so iOS users get no native install button.
 * This card is the manual path, styled from the founder's reference image
 * (2026-07-04). Parameterized so ELOSTATE and ELOSTATE Sales Coach share ONE
 * component (§A21 — one card, two configs) rather than a forked copy.
 *
 * Faithfulness note (§2, surfaced in the build report, not silently changed):
 * the four steps mirror the founder's reference flow exactly
 * (••• → Share → View More → Add to Home Screen). Standard iOS Safari is the
 * shorter Share → Add to Home Screen; the reference flow is reproduced as
 * given rather than substituted.
 */

export type InstallAppConfig = {
  /** Full name in the title and body, e.g. "ELOSTATE Sales Coach". */
  displayName: string;
  /** The URL the user sees in the browser bar, e.g. "elostate.com". */
  url: string;
  /** Public path to the app icon SVG, e.g. "/sales-coach-icon.svg". */
  iconSrc: string;
  /** Where the footer "back" link goes, so the page isn't a dead end. */
  backHref: string;
  /** Label for the back link, e.g. "Back to sign in". */
  backLabel: string;
};

export function InstallInstructions({ app }: { app: InstallAppConfig }) {
  return (
    <div className="min-h-dvh bg-base text-primary flex flex-col items-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Card — dark with a soft gold frame + glow, echoing the reference. */}
      <div className="relative w-full max-w-md rounded-3xl border border-ember-400/30 bg-[#0B0B0F] shadow-[0_0_60px_-15px_rgba(250,204,21,0.25)] overflow-hidden">
        {/* Faint gold topographic wash, like the reference background. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, rgba(250,204,21,0.25), transparent 45%), radial-gradient(circle at 90% 80%, rgba(250,204,21,0.18), transparent 40%)",
          }}
        />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={app.iconSrc}
              alt=""
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl shrink-0"
            />
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
              Install{" "}
              <span className="text-brand">{app.displayName}</span> on your
              phone
            </h1>
          </div>
          <p className="text-sm text-secondary leading-relaxed mb-6">
            A few taps and {app.displayName} lives on your home screen — no app
            store, no download.
          </p>

          {/* ── iPhone · Safari — the founder's reference flow, kept verbatim
              (founder 2026-07-05: this flow is for iPhone/Safari). ── */}
          <PlatformLabel label="On iPhone · Safari" />

          {/* Step 1 */}
          <Step
            n={1}
            text={
              <>
                Open {app.displayName} in your browser and tap the{" "}
                <span className="text-brand font-semibold">&ldquo;…&rdquo;</span>{" "}
                menu button in the bottom bar.
              </>
            }
          >
            <div className="flex items-center gap-2 rounded-xl border border-ember-400/40 bg-black/40 px-3 py-2.5">
              <ChevronLeft className="w-4 h-4 text-muted shrink-0" aria-hidden />
              <span className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-secondary">
                <Lock className="w-3 h-3 text-brand shrink-0" aria-hidden />
                <span className="truncate font-mono">{app.url}</span>
              </span>
              <RotateCw className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
              <Target>
                <MoreHorizontal className="w-4 h-4 text-brand" aria-hidden />
              </Target>
            </div>
          </Step>

          {/* Step 2 */}
          <Step
            n={2}
            text={
              <>
                Tap the{" "}
                <span className="text-brand font-semibold">Share</span> icon in
                the menu.
              </>
            }
          >
            <div className="rounded-xl border border-ember-400/40 bg-black/40 divide-y divide-white/[0.06] overflow-hidden">
              <MockRow icon={Share} label="Share" targeted />
              <MockRow icon={Bookmark} label="Add to Bookmarks" />
              <MockRow icon={FolderClosed} label="Add Bookmark to…" />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-brand/80">
                <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                View More
              </div>
            </div>
          </Step>

          {/* Step 3 */}
          <Step
            n={3}
            text={
              <>
                In the menu, tap{" "}
                <span className="text-brand font-semibold">
                  &ldquo;View More&rdquo;
                </span>{" "}
                (the &ldquo;v&rdquo;).
              </>
            }
          />

          {/* Step 4 */}
          <Step
            n={4}
            last
            text={
              <>
                Then tap{" "}
                <span className="text-brand font-semibold">
                  &ldquo;Add to Home Screen&rdquo;
                </span>
                .
              </>
            }
          >
            <div className="rounded-xl border border-ember-400/40 bg-black/40 divide-y divide-white/[0.06] overflow-hidden">
              <MockRow icon={FolderClosed} label="Add Bookmark to…" />
              <MockRow icon={Star} label="Add to Favorites" />
              <MockRow icon={PlusSquare} label="Add to Home Screen" targeted />
              <MockRow icon={SquarePen} label="Markup" />
            </div>
          </Step>

          {/* ── Android · Chrome — the reference covers iPhone only, so Android
              gets Chrome's standard install flow (founder 2026-07-05: "that's
              only for iphone/safari not android"). ── */}
          <PlatformLabel label="On Android · Chrome" className="mt-7" />

          {/* Android Step 1 */}
          <Step
            n={1}
            text={
              <>
                Open {app.displayName} in Chrome and tap the{" "}
                <span className="text-brand font-semibold">⋮</span> menu in the
                top-right.
              </>
            }
          >
            <div className="flex items-center gap-2 rounded-xl border border-ember-400/40 bg-black/40 px-3 py-2.5">
              <span className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-secondary">
                <Lock className="w-3 h-3 text-brand shrink-0" aria-hidden />
                <span className="truncate font-mono">{app.url}</span>
              </span>
              <Target>
                <MoreVertical className="w-4 h-4 text-brand" aria-hidden />
              </Target>
            </div>
          </Step>

          {/* Android Step 2 */}
          <Step
            n={2}
            text={
              <>
                Tap{" "}
                <span className="text-brand font-semibold">
                  &ldquo;Install app&rdquo;
                </span>{" "}
                (or &ldquo;Add to Home screen&rdquo;).
              </>
            }
          >
            <div className="rounded-xl border border-ember-400/40 bg-black/40 divide-y divide-white/[0.06] overflow-hidden">
              <MockRow icon={Share} label="Share…" />
              <MockRow icon={Download} label="Install app" targeted />
              <MockRow icon={PlusSquare} label="Add to Home screen" />
            </div>
          </Step>

          {/* Android Step 3 */}
          <Step
            n={3}
            last
            text={
              <>
                Tap{" "}
                <span className="text-brand font-semibold">
                  &ldquo;Install&rdquo;
                </span>{" "}
                to confirm.
              </>
            }
          >
            <div className="flex items-center gap-3 rounded-xl border border-ember-400/40 bg-black/40 px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={app.iconSrc}
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-primary font-semibold truncate">
                  {app.displayName}
                </span>
                <span className="block text-[10px] text-muted font-mono truncate">
                  {app.url}
                </span>
              </span>
              <Target>
                <span className="text-xs font-bold text-brand px-1">Install</span>
              </Target>
            </div>
          </Step>

          {/* Footer — where to open it. */}
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-center">
            <p className="text-[11px] uppercase tracking-widest text-muted font-bold">
              Open it at
            </p>
            <p className="text-sm font-mono text-brand mt-0.5">{app.url}</p>
          </div>

          {/* Onward link — the page is reached from sign-in / the install
              prompt, so give the reader a way back instead of a dead end
              (audit F4; AMD-006 §1.5.1 layer-3 continuity). */}
          <div className="mt-4 text-center">
            <Link
              href={app.backHref}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              {app.backLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A numbered step: gold circle + text, with an optional mockup below. */
function Step({
  n,
  text,
  children,
  last,
}: {
  n: number;
  text: React.ReactNode;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full border-2 border-ember-400 text-brand text-xs font-bold flex items-center justify-center mt-0.5">
          {n}
        </span>
        <p className="text-sm text-primary leading-relaxed">{text}</p>
      </div>
      {children && <div className="mt-2.5 pl-9">{children}</div>}
    </div>
  );
}

/** A row in a mocked iOS menu; `targeted` gets the gold ring + arrow. */
function MockRow({
  icon: Icon,
  label,
  targeted,
}: {
  icon: typeof Share;
  label: string;
  targeted?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${
        targeted ? "bg-ember-400/15" : ""
      }`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${targeted ? "text-brand" : "text-secondary"}`}
        aria-hidden
      />
      <span
        className={`flex-1 text-sm ${targeted ? "text-primary font-semibold" : "text-secondary"}`}
      >
        {label}
      </span>
      {targeted && (
        <ArrowRight
          className="w-4 h-4 text-brand shrink-0 -rotate-45"
          aria-hidden
        />
      )}
    </div>
  );
}

/** Wraps an element in the gold "tap here" ring + arrow, like the reference. */
function Target({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center rounded-lg ring-2 ring-ember-400 bg-ember-400/15 px-1.5 py-1 shrink-0">
      {children}
    </span>
  );
}

/** A gold platform divider label, e.g. "On iPhone · Safari". */
function PlatformLabel({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-3 ${className}`}>
      <Smartphone className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden />
      <span className="text-[11px] uppercase tracking-widest text-brand font-bold">
        {label}
      </span>
      <span className="flex-1 h-px bg-ember-400/20" />
    </div>
  );
}
