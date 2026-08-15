"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CTA } from "../brand";
import styles from "./WowHero.module.css";

/**
 * Hero — candidate v2 (2026-08-15), founder-approved headline A: "Your team stops needing us."
 *
 * v1 was rejected, correctly: it was a split hero with a chat-panel mockup, i.e. exactly the
 * "enterprise-dashboard" the 2026-08-02 brief forbids. This version is built to the brief's own
 * words — "Apple-keynote, not enterprise-dashboard": ONE idea, one light source, huge confident
 * type, and nothing else on the screen competing for attention.
 *
 * The visual concept: the filament-e draws itself in a single unbroken stroke, ignites, and the
 * light it throws is what REVEALS the headline — the type is masked by a radial gradient that
 * expands from the filament. Insight literally lighting the sentence. That is the hook, and it
 * resolves in about 3 seconds as the brief requires.
 *
 * Built on framer-motion (^12.43.0), which the brief named and which was installed and then never
 * imported by a single file in src/ — the gap this rebuild closes.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export function WowHero() {
  const reduce = useReducedMotion();


  return (
    <section className={styles.wrap}>
      <div className={styles.vignette} aria-hidden />

      <nav className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="Elostate — home">
          <Filament size={26} animate={!reduce} />
          <span className={styles.word}>ELOSTATE</span>
        </Link>
        <div className={styles.navr}>
          <Link href="#differentiator" className={styles.navlink}>How it works</Link>
          <Link href={CTA.signInHref} className={styles.navlink}>Sign in</Link>
          <Link href={CTA.primaryHref} className={styles.pill}>{CTA.primaryLabel}</Link>
        </div>
      </nav>

      <div className={styles.stage}>
        {/* the light source — everything on this screen is lit by it */}
        <motion.div
          className={styles.lamp}
          initial={reduce ? { scale: 1 } : { scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
        >
          <Filament size={104} animate={!reduce} big />
          <motion.div
            className={styles.halo}
            aria-hidden
            initial={{ opacity: 0.55 }}
            animate={{ opacity: [0, 0.75, 0.55] }}
            transition={{ duration: 1.6, delay: 1.15, ease: "easeOut", times: [0, 0.4, 1] }}
          />
        </motion.div>

        {/* The headline rises into the light, line by line, behind a clip.
            FAIL-VISIBLE by construction: the text is in normal flow at full opacity and only the
            TRANSFORM is animated, so if motion never runs the sentence is still on screen. The
            first version of this masked the type with an animated @property radial gradient — when
            that animation had not run, the mask radius was 0 and the headline was INVISIBLE. That
            is a reveal that fails closed, the exact inverse of Reveal.tsx's stated rule that
            content ships visible and JS only arms the hide-then-reveal. */}
        <h1 className={styles.headline}>
          {["Your team", "stops needing us."].map((line, i) => (
            <span className={styles.lineClip} key={line}>
              <motion.span
                className={styles.line}
                initial={reduce ? { y: 0 } : { y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.05, delay: reduce ? 0 : 0.45 + i * 0.1, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <p className={styles.sub}>
          Month one, we say nothing. We measure your team exactly as they are — no guidance, no
          invented insights. Then we show you the difference, in your own numbers.
        </p>

        <div className={styles.ctaRow}>
          <Link href={CTA.primaryHref} className={styles.btnPrimary}>
            {CTA.primaryLabel}
            <span className={styles.arrow} aria-hidden>→</span>
          </Link>
          <a href="#differentiator" className={styles.btnGhost}>See it work</a>
        </div>

        <div className={styles.tagline}>
          Where simplicity meets productivity — built by business owners just like you.
        </div>
      </div>

      <motion.div
        className={styles.scroll}
        aria-hidden
        initial={{ opacity: 0.6 }}
        animate={{ opacity: reduce ? 1 : [0.6, 1, 0.35, 1] }}
        transition={{ duration: 3, delay: 3, repeat: reduce ? 0 : Infinity, repeatDelay: 1 }}
      >
        <span>SCROLL</span>
        <i />
      </motion.div>
    </section>
  );
}

/**
 * The filament-e mark, drawn as one continuous stroke. `pathLength` animation is the whole trick:
 * the line writes itself, then the glow arrives. Local to this candidate so the shipped Bulb
 * component is untouched while the direction is under review.
 */
function Filament({ size, animate, big = false }: { size: number; animate: boolean; big?: boolean }) {
  const draw = animate
    ? {
        initial: { pathLength: 0.001, opacity: 1 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: big ? 1.7 : 1, delay: big ? 0.35 : 0, ease: EASE },
      }
    : { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={big ? styles.markBig : styles.mark}
      aria-hidden
    >
      {/* bulb envelope */}
      <motion.path
        d="M24 4c-7.7 0-14 6.1-14 13.6 0 4.9 2.4 8.4 4.9 11.2 1.8 2 2.6 3.3 2.9 5.2h12.4c.3-1.9 1.1-3.2 2.9-5.2 2.5-2.8 4.9-6.3 4.9-11.2C38 10.1 31.7 4 24 4Z"
        stroke="var(--signal)"
        strokeWidth={2.4}
        strokeLinejoin="round"
        {...draw}
      />
      {/* the "e" filament — one unbroken stroke */}
      <motion.path
        d="M18.5 22.4h11c0-3-2.4-5.2-5.5-5.2s-5.5 2.3-5.5 5.4c0 3.2 2.5 5.4 5.8 5.4 1.9 0 3.5-.7 4.6-1.8"
        stroke="var(--signal)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw}
        transition={{ ...(draw.transition ?? {}), delay: big ? 1.05 : 0.25 }}
      />
      {/* base */}
      <motion.path
        d="M19 38h10M20.5 42.5h7"
        stroke="var(--signal)"
        strokeWidth={2.4}
        strokeLinecap="round"
        {...draw}
        transition={{ ...(draw.transition ?? {}), delay: big ? 1.35 : 0.4 }}
      />
    </svg>
  );
}
