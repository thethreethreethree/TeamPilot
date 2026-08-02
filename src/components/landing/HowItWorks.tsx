import { Reveal } from "./Reveal";
import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    n: "1",
    title: "Understand",
    text: "It reads what's actually happening — the messages, meetings, and work — and finds the real problem, not the symptom.",
  },
  {
    n: "2",
    title: "Guide",
    text: "It doesn't hand over the answer. It asks what you think first, then offers a sharper one — and the why behind it.",
  },
  {
    n: "3",
    title: "Grow",
    text: "Every resolution makes the system smarter about your team. It gets better because your people do.",
  },
];

// HOW IT WORKS — understand → guide → grow. Mirrors the real Living-Diagnosis method (§1): diagnose
// the root cause, guide without overtaking, close the loop so it compounds.
export function HowItWorks() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.eyebrow}>How it works</div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className={styles.heading}>
            Understand. Guide. <span className={styles.em}>Grow.</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sub}>Three moves, on repeat — and the loop gets smarter about your team every time.</p>
        </Reveal>

        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={160 + i * 110}>
              <div className={styles.step}>
                <div className={styles.dot}>{s.n}</div>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepText}>{s.text}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
