"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bulb } from "./Bulb";
import { CTA } from "./brand";
import styles from "./Hero.module.css";

export function Hero() {
  const auraRef = useRef<HTMLDivElement>(null);

  // Ambient glow follows the cursor. Pointer-driven (no re-renders); skipped for reduced-motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = auraRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section className={styles.heroSection}>
      <div className={styles.aura} ref={auraRef} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <nav className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="Elostate — home">
          <Bulb size={30} />
          <span className={styles.word}>ELOSTATE</span>
        </Link>
        <div className={styles.navr}>
          <Link href="#modules" className={styles.navlink}>Product</Link>
          <Link href={CTA.signInHref} className={styles.navlink}>Sign in</Link>
          <Link href={CTA.primaryHref} className={styles.pill}>{CTA.primaryLabel}</Link>
        </div>
      </nav>

      <div className={styles.heroBody}>
        <div className={`${styles.bulbWrap}`}>
          <Bulb size={128} draw pulse />
        </div>
        <div className={`${styles.eyebrow} ${styles.rise} ${styles.d1}`}>Where simplicity meets productivity</div>
        <h1 className={styles.headline}>
          <span className={`${styles.line} ${styles.rise} ${styles.d2}`}>Don&apos;t just manage your team.</span>
          <span className={`${styles.line} ${styles.line2} ${styles.rise} ${styles.d3}`}>
            <span className={styles.think}>
              Make it think.
              <span className={styles.ul} aria-hidden />
            </span>
          </span>
        </h1>
        <p className={`${styles.sub} ${styles.rise} ${styles.d5}`}>
          One platform that sharpens people, replaces the four tools you&apos;re stitching together, and
          measures the lift — in your own data.
        </p>
        <div className={`${styles.cta} ${styles.rise} ${styles.d6}`}>
          <Link href={CTA.primaryHref} className={`${styles.btn} ${styles.btnP}`}>{CTA.primaryLabel}</Link>
          <a href="#differentiator" className={`${styles.btn} ${styles.btnG}`}>See it work&nbsp;&nbsp;→</a>
        </div>
        <div className={`${styles.tag} ${styles.rise} ${styles.d6}`}>Built by business owners just like you.</div>
      </div>

      <div className={styles.scroll} aria-hidden><span>SCROLL ↓</span></div>
    </section>
  );
}
