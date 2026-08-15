"use client";

import { useState } from "react";
import { Rise } from "./Rise";
import styles from "./WowDifferentiator.module.css";

/**
 * The differentiator — candidate (2026-08-15). The 2026-08-02 brief names this and the hero as
 * highest priority, and asks for "show, don't tell: an animated before/after or a visual of the
 * system surfacing WHY something's wrong, not just THAT it is."
 *
 * So it is literally a before/after the visitor operates. Drag the divider (or use the keyboard —
 * it is a real range input, so this is accessible and works without pointer events):
 *
 *   left  = every other tool: the number went down. A fact with no cause.
 *   right = Elostate: WHY it went down, with the evidence it reasoned from.
 *
 * The visitor performs the product's core act — moving from "that" to "why" — with their own hand.
 * That is the argument made as behaviour rather than as a claim, which is what the brief asked for.
 */
export function WowDifferentiator() {
  const [pos, setPos] = useState(34);

  return (
    <section className={styles.wrap} id="differentiator">
      <div className={styles.inner}>
        <Rise className={styles.head} y={20}>
          <div className={styles.eyebrow}>The difference</div>
          <h2 className={styles.title}>
            Every tool tells you <span className={styles.dim}>that</span>.
            <br />
            Ours tells you <span className={styles.accent}>why</span>.
          </h2>
          <p className={styles.lede}>
            Drag it. This is the whole product in one gesture.
          </p>
        </Rise>

        <Rise className={styles.frame} y={28} delay={0.12}>
        <div className={styles.frameInner} style={{ ["--pos" as string]: `${pos}%` }}>
          {/* BEFORE — the flat number */}
          <div className={styles.before}>
            <div className={styles.label}>Every other tool</div>
            <div className={styles.stat}>
              <span className={styles.statNum}>&minus;12%</span>
              <span className={styles.statLbl}>close rate, this month</span>
            </div>
            <div className={styles.flatline} aria-hidden>
              <svg viewBox="0 0 320 60" preserveAspectRatio="none">
                <polyline
                  points="0,18 40,22 80,20 120,28 160,26 200,36 240,34 280,44 320,42"
                  fill="none" stroke="rgba(247,247,245,.30)" strokeWidth="2"
                />
              </svg>
            </div>
            <div className={styles.verdict}>Something is wrong.</div>
          </div>

          {/* AFTER — the diagnosis */}
          <div className={styles.after}>
            <div className={styles.afterInner}>
              <div className={`${styles.label} ${styles.labelOn}`}>Elostate</div>
              <p className={styles.diagnosis}>
                Close rate fell because <strong>discovery was skipped on 11 of 14 lost calls</strong>
                &nbsp;— all by reps hired in the last 60 days.
              </p>
              <div className={styles.evidence}>
                <span className={styles.chip}>14 lost calls read</span>
                <span className={styles.chip}>3 reps, all &lt;60 days</span>
                <span className={styles.chip}>held 4 of 5 last time</span>
              </div>
              <div className={styles.gate}>
                <i className={styles.gateDot} aria-hidden />
                Surfaced only after 3 signals from 2 independent sources. Below that
                threshold we say nothing.
              </div>
            </div>
          </div>

          {/* the handle — a real input, so keyboard and screen readers work */}
          <div className={styles.divider} aria-hidden>
            <span className={styles.knob}>
              <span className={styles.chev}>‹</span>
              <span className={styles.chev}>›</span>
            </span>
          </div>
          <input
            className={styles.range}
            type="range"
            min={4}
            max={96}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Reveal the diagnosis: drag to compare a plain metric against Elostate's explanation"
          />
        </div>
        </Rise>

        <p className={styles.foot}>
          That threshold is enforced in the database, not in a prompt. A problem that
          isn&rsquo;t supported by evidence <em>cannot</em> reach you.
        </p>
      </div>
    </section>
  );
}
