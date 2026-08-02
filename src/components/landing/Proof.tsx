import { Reveal } from "./Reveal";
import { CountUp } from "./CountUp";
import styles from "./Proof.module.css";

// PROOF — the honesty moat (founder message #3): we prove value in YOUR data, not benchmarks.
// The stat tiles are honest STRUCTURAL facts about the offer (not fabricated customer results);
// the testimonial cards are deliberate, clearly-labeled placeholders to fill as the pilot ships.
export function Proof() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.eyebrow}>Proof</div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className={styles.heading}>
            We don&apos;t ask you to trust us. We prove it in <span className={styles.em}>your data</span>.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sub}>
            Month one, we measure your baseline — no guidance, just the honest picture. Month two, the guidance
            turns on. The only thing that changed is the method — so the improvement is real, and it&apos;s yours.
          </p>
        </Reveal>

        <div className={styles.stats}>
          <Reveal delay={140}>
            <div className={styles.stat}>
              <div className={styles.statNum}>
                <CountUp value={4} />
              </div>
              <div className={styles.statLabel}>disconnected tools, replaced by one platform</div>
            </div>
          </Reveal>
          <Reveal delay={220}>
            <div className={styles.stat}>
              <div className={styles.statNum}>
                <CountUp value={2} />
              </div>
              <div className={styles.statLabel}>months to your first measured, attributable proof point</div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className={styles.stat}>
              <div className={styles.statNum}>
                <CountUp value={100} suffix="%" />
              </div>
              <div className={styles.statLabel}>measured on your team&apos;s data — never industry benchmarks</div>
            </div>
          </Reveal>
        </div>

        <div className={styles.quotes}>
          {[0, 1, 2].map((i) => (
            <Reveal key={i} delay={160 + i * 80}>
              <div className={styles.quote}>
                <div className={styles.mark}>&ldquo;</div>
                <div className={styles.qText}>[A customer&apos;s words about the outcome — the shorter meetings, the problems that stopped coming back.]</div>
                <div className={styles.qWho}>— [Name], [Role, Company]</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <p className={styles.placeholderNote}>Placeholder — real quotes from pilot customers drop in here as the proof lands.</p>
        </Reveal>
      </div>
    </section>
  );
}
