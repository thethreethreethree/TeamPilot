import { Reveal } from "./Reveal";
import styles from "./Differentiator.module.css";

// THE SHOWPIECE — shows the diagnostic engine finding the *why*, not just the *what*.
// A surface symptom every tool would flag, then the causal trace down to the actual root cause,
// which lights up. Reveals sequentially on scroll (robust Reveal wrapper).
export function Differentiator() {
  return (
    <section id="differentiator" className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.eyebrow}>The difference</div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className={styles.heading}>
            Most tools tell you <span className={styles.em}>what&apos;s</span> wrong. We show you{" "}
            <span className={styles.em}>why</span>.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sub}>
            The diagnostic engine doesn&apos;t stop at the symptom. It traces the signals back to the
            real cause — so your team fixes the thing that&apos;s actually broken.
          </p>
        </Reveal>

        <div className={styles.diagram}>
          <Reveal>
            <div className={`${styles.card} ${styles.symptom}`}>
              <div className={styles.cardLabel}>What every other tool shows you</div>
              <div className={styles.cardBody}>&ldquo;Projects keep slipping. Meetings keep running long.&rdquo;</div>
              <div className={styles.symptomMeta}>
                <span className={styles.down}>▼</span> On-time delivery down 18% this quarter
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className={styles.divider}>
              <span>↑ where other tools stop</span>
              <div className={styles.rule} />
              <span>where Elostate begins ↓</span>
            </div>
          </Reveal>

          <div className={styles.trace}>
            <Reveal delay={120}>
              <div className={styles.node}>
                <b>14 messages</b> re-litigating the same call
              </div>
            </Reveal>
            <Reveal delay={220}>
              <div className={styles.node}>
                <b>3 meetings</b> booked · <b>0 decisions</b> logged
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className={styles.node}>
                the same blocker <b>reopened twice</b>
              </div>
            </Reveal>
          </div>

          <Reveal delay={420}>
            <div className={`${styles.card} ${styles.root}`}>
              <div className={styles.cardLabel}>The actual problem</div>
              <div className={styles.cardBody}>Decisions are being deferred, not made.</div>
              <div className={styles.fix}>→ Fix the decision ritual — not the meeting length.</div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <p className={styles.punch}>
            That&apos;s the difference between a tool that <b>reports</b> and a system that{" "}
            <b>understands</b>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
