import { Reveal } from "./Reveal";
import styles from "./Problem.module.css";

const PAINS = [
  {
    n: "01",
    title: "Four tools that don't talk",
    text: "Projects here. Chat there. Support somewhere else. Books in a spreadsheet. Nothing connects — so nothing adds up.",
  },
  {
    n: "02",
    title: "Meetings that decide nothing",
    text: "An hour in the room. Zero decisions logged. Everyone leaves unsure who owns what — so you meet again next week.",
  },
  {
    n: "03",
    title: "The same problems, on repeat",
    text: "You fixed it last quarter. It's back this quarter — because nobody ever found out why it happened.",
  },
  {
    n: "04",
    title: "Dashboards everywhere, insight nowhere",
    text: "You can measure everything and still not know what to do next. Numbers aren't answers.",
  },
];

// THE PROBLEM — dramatize the pain, build tension. Red-tinted mood so the yellow "turn" lands harder.
export function Problem() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.eyebrow}>The problem</div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className={styles.heading}>Busy has never been the same as better.</h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sub}>
            Your team works hard. But the work is scattered across tools that don&apos;t talk — so effort leaks,
            decisions stall, and the same problems keep coming back.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {PAINS.map((p, i) => (
            <Reveal key={p.n} delay={140 + i * 90}>
              <div className={styles.card}>
                <div className={styles.num}>{p.n}</div>
                <div className={styles.cardTitle}>{p.title}</div>
                <div className={styles.cardText}>{p.text}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className={styles.kicker}>
            None of it is a people problem. <span>It&apos;s a system problem.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
