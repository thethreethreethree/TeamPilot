"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CTA } from "../brand";
import { Rise } from "./Rise";
import styles from "./WowSections.module.css";

/**
 * Sections 2-9 of the landing rebuild, to the 2026-08-02 brief's emotional arc:
 *   problem -> turn -> how it works -> modules -> [differentiator] -> proof -> close -> footer
 *
 * Each section gets its OWN motion idea rather than the 42 repetitions of one fade the shipped page
 * uses. The brief's words: "Smooth scroll-triggered animations - elements reveal and move as you
 * scroll. This is most of the 'wow.'"
 *
 * FAIL-VISIBLE, enforced by construction (check.md F1 in this build's predecessor): no entrance here
 * starts from opacity:0. Everything animates TRANSFORM only, so an unrun animation leaves content
 * present-but-unslid rather than invisible. That defect shipped three times in the hero build before
 * being swept; this file was written after the sweep and must not reintroduce it.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────── 2. THE PROBLEM ─────────────────────────────── */
/* Brief: "dramatize the pain... Punchy, animated, emotional. Build tension."
   Motion idea: four tools DRIFT APART as you scroll and their connecting lines go slack. The
   fragmentation is shown, not described. */

const TOOLS = [
  { name: "Project tool", note: "tasks nobody re-reads" },
  { name: "Chat", note: "decisions that scroll away" },
  { name: "Docs", note: "written once, never opened" },
  { name: "Spreadsheets", note: "the real system of record" },
];

function Problem() {
  const reduce = useReducedMotion();
  return (
    <section className={styles.problem}>
      <div className={styles.inner}>
        <Rise>
          <div className={styles.eyebrow}>The problem</div>
          <h2 className={styles.h2}>
            Four tools. <span className={styles.dim}>None of them talking.</span>
          </h2>
          <p className={styles.lede}>
            Your team isn&rsquo;t short of software. They&rsquo;re short of a place where the
            same problem stops arriving twice.
          </p>
        </Rise>

        <div className={styles.drift}>
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.name}
              className={styles.tool}
              initial={reduce ? { x: 0, rotate: 0 } : { x: 0, rotate: 0 }}
              whileInView={
                reduce ? {} : { x: [0, (i - 1.5) * 22], rotate: [0, (i - 1.5) * 2.2] }
              }
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.5, delay: 0.15 + i * 0.08, ease: EASE }}
            >
              <span className={styles.toolName}>{t.name}</span>
              <span className={styles.toolNote}>{t.note}</span>
            </motion.div>
          ))}
        </div>

        <Rise delay={0.15}>
          <p className={styles.sting}>
            So the same three problems come back every quarter, and everyone is too busy to
            notice they&rsquo;re the same three.
          </p>
        </Rise>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 3. THE TURN ─────────────────────────────── */
/* Brief: "introduce Elostate as the answer... it makes people sharper, not dependent."
   Motion idea: the single bright moment on the page. Everything converges. */

function Turn() {
  return (
    <section className={styles.turn}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <Rise y={34}>
          <h2 className={styles.turnLine}>
            We don&rsquo;t manage your team.
            <br />
            <span className={styles.accent}>We make them sharper.</span>
          </h2>
          <p className={styles.turnSub}>
            Elostate reads what actually happened — the decisions, the reversals, the problems that
            reopened — and hands your people the diagnosis so they solve it themselves. Reliance
            goes down, not up. That is the whole design.
          </p>
        </Rise>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 4. HOW IT WORKS ─────────────────────────────── */
/* Brief: "3 simple steps, visually clean (understand -> guide -> grow). Minimal text."
   Motion idea: a line draws itself between the three beats as you scroll. */

const STEPS = [
  { n: "01", t: "Understand", d: "One month of listening. No advice, no scores, no invented insight — a clean baseline of your team as it is." },
  { n: "02", t: "Guide", d: "It asks what you think first, then offers a diagnosis with its reasoning. You stay the decider." },
  { n: "03", t: "Grow", d: "Every resolution and its real outcome feeds back. It gets sharper about your team, not about teams in general." },
];

function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section className={styles.how} id="how">
      <div className={styles.inner}>
        <Rise>
          <div className={styles.eyebrow}>How it works</div>
          <h2 className={styles.h2}>Three beats. No magic.</h2>
        </Rise>

        <div className={styles.steps}>
          <motion.div
            className={styles.thread}
            aria-hidden
            initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
          {STEPS.map((s, i) => (
            <Rise key={s.n} delay={0.12 * i} className={styles.step}>
              <div className={styles.stepN}>{s.n}</div>
              <h3 className={styles.stepT}>{s.t}</h3>
              <p className={styles.stepD}>{s.d}</p>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 5. THE MODULES ─────────────────────────────── */
/* Brief: "show the platform breadth as an INTERACTIVE/animated grid. Convey 'one platform,
   everything' without overwhelming."
   Motion idea: hovering a module lights only its own connections — one platform demonstrated as
   behaviour rather than asserted as a claim. */

const MODULES = [
  { k: "base", t: "Elostate", d: "The diagnostic core. Events, signals, problems, resolutions — the chain everything else reads from." },
  { k: "coach", t: "Sales Coach", d: "Live coaching at the door, scored against the rep's own baseline. Not a leaderboard." },
  { k: "care", t: "C.A.R.E", d: "Customer support that drafts in your voice and tells you when it is guessing." },
  { k: "fin", t: "Financial", d: "Books that stay balanced by construction, with the invariants enforced in the schema." },
];

function Modules() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <section className={styles.modules}>
      <div className={styles.inner}>
        <Rise>
          <div className={styles.eyebrow}>The platform</div>
          <h2 className={styles.h2}>
            One brain. <span className={styles.dim}>Four surfaces.</span>
          </h2>
          <p className={styles.lede}>
            They share one record. A problem C.A.R.E sees is a problem Sales Coach already knows about.
          </p>
        </Rise>

        <div
          className={`${styles.grid} ${active ? styles.gridDim : ""}`}
          onMouseLeave={() => setActive(null)}
        >
          {MODULES.map((m, i) => (
            <Rise key={m.k} delay={0.07 * i}>
              <div
                className={`${styles.card} ${active === m.k ? styles.cardOn : ""}`}
                onMouseEnter={() => setActive(m.k)}
                onFocus={() => setActive(m.k)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="group"
                aria-label={m.t}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardDot} aria-hidden />
                  <h3 className={styles.cardT}>{m.t}</h3>
                </div>
                <p className={styles.cardD}>{m.d}</p>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 7. PROOF ─────────────────────────────── */
/* Brief: "big animated numbers... structured for impact."
   Honesty constraint from CLAUDE.md §3.4: we do NOT fabricate customer metrics. Every number here
   is a property of the SYSTEM, verifiable from the product itself, not a claimed customer outcome. */

function Count({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const reduce = useReducedMotion();
  // FAIL-TRUE, not merely fail-visible. The counter's resting value is the REAL number, and the
  // animation only ever runs after JS has proven it can. Starting at 0 made the page assert
  // "0 days of silence" and "0 signals minimum" whenever the animation had not run — not missing
  // content but INVERTED content, a confidently-wrong claim about our own honesty guarantees.
  // Same class as F1 in the hero build, one altitude up: there the failure hid the truth, here it
  // stated its opposite. SSR renders `to`; hydration drops to 0 only when we are about to animate.
  const [v, setV] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    setV(0);
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting || done.current) continue;
          done.current = true;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / 1100);
            setV(to * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, reduce]);

  return (
    <span ref={ref}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function Proof() {
  return (
    <section className={styles.proof}>
      <div className={styles.inner}>
        <Rise>
          <div className={styles.eyebrow}>What we will and won&rsquo;t claim</div>
          <h2 className={styles.h2}>No testimonials yet. We&rsquo;d rather say so.</h2>
          <p className={styles.lede}>
            Every number below is a property of the system you can check for yourself. None of them is
            a customer outcome we have not earned.
          </p>
        </Rise>

        <div className={styles.stats}>
          <Rise delay={0.05}>
            <div className={styles.stat}>
              <div className={styles.statN}>
                <Count to={30} suffix=" days" />
              </div>
              <div className={styles.statL}>
                of silence before the AI gives a single piece of guidance — enforced in code, not policy
              </div>
            </div>
          </Rise>
          <Rise delay={0.12}>
            <div className={styles.stat}>
              <div className={styles.statN}>
                <Count to={3} /> <span className={styles.statSm}>signals</span>
              </div>
              <div className={styles.statL}>
                minimum, from 2 independent sources, before a problem may reach a human — enforced by the
                database
              </div>
            </div>
          </Rise>
          <Rise delay={0.19}>
            <div className={styles.stat}>
              <div className={styles.statN}>
                <Count to={0} />
              </div>
              <div className={styles.statL}>
                fabricated insights, by construction — a problem without evidence cannot be surfaced at all
              </div>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 8. THE CLOSE ─────────────────────────────── */

function Close() {
  return (
    <section className={styles.close}>
      <div className={styles.closeGlow} aria-hidden />
      <div className={styles.inner}>
        <Rise y={30}>
          <h2 className={styles.closeH}>
            Prove it in your own data.
          </h2>
          <p className={styles.closeSub}>
            Month one costs you nothing but honesty — we measure, we stay quiet. If the second month
            doesn&rsquo;t show a difference in your own numbers, you have lost a month of listening and
            nothing else.
          </p>
          <div className={styles.closeCta}>
            <Link href={CTA.primaryHref} className={styles.btnPrimary}>
              {CTA.primaryLabel}
              <span className={styles.arrow} aria-hidden>→</span>
            </Link>
            <Link href={CTA.signInHref} className={styles.btnGhost}>
              Sign in
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 9. FOOTER ─────────────────────────────── */

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.footRow}>
          <span className={styles.footBrand}>ELOSTATE</span>
          <nav className={styles.footNav}>
            <Link href="/privacy" className={styles.footLink}>Privacy</Link>
            <Link href="/terms" className={styles.footLink}>Terms</Link>
            <Link href={CTA.signInHref} className={styles.footLink}>Sign in</Link>
          </nav>
        </div>
        <p className={styles.footNote}>
          Where simplicity meets productivity — built by business owners just like you.
        </p>
      </div>
    </footer>
  );
}

export function WowSections() {
  return (
    <>
      <Problem />
      <Turn />
      <HowItWorks />
      <Modules />
    </>
  );
}

export function WowSectionsAfter() {
  return (
    <>
      <Proof />
      <Close />
      <Footer />
    </>
  );
}
