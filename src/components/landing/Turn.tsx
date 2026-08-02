import { Reveal } from "./Reveal";
import { Bulb } from "./Bulb";
import styles from "./Turn.module.css";

// THE TURN — the pivot. Introduce Elostate as the answer and state the one thing that makes it
// different: it makes people sharper, not dependent on it.
export function Turn() {
  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.bulb}>
            <Bulb size={64} pulse />
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div className={styles.eyebrow}>The turn</div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className={styles.heading}>
            So we built a system that makes people <span className={styles.em}>sharper</span> — not dependent.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className={styles.sub}>
            Elostate runs your team, support, sales, and books in one place. But the real shift is the AI: it
            doesn&apos;t do the thinking for your people — it helps them see the real problem, make the call, and
            get better every time.
          </p>
        </Reveal>
        <Reveal delay={280}>
          <div className={styles.pledge}>
            Most software makes you depend on it. Ours makes your team <b>better without it.</b>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
