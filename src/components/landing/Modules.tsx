import { Reveal } from "./Reveal";
import styles from "./Modules.module.css";

const Y = "#FFDA03";

const MODULES = [
  {
    key: "elostate",
    title: "Elostate",
    tag: "the core",
    text: "Run your team, projects, and tasks — with the diagnostic engine and a learning Brain that finds your real bottlenecks.",
    replaces: <>Replaces <b>Monday / Asana / ClickUp</b></>,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="5" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="18" r="2.2" />
        <path d="M12 7.2 7 15.8M12 7.2l5 8.6M7 18h10" />
      </svg>
    ),
  },
  {
    key: "care",
    title: "C.A.R.E",
    tag: "support & CRM",
    text: "An AI support desk that resolves faster — flat and unlimited, never per-ticket — with the customer context built in.",
    replaces: <>Replaces <b>Intercom / Zendesk</b></>,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-4 3.5V16H4z" /><path d="M8 10h8M8 13h5" />
      </svg>
    ),
  },
  {
    key: "coach",
    title: "Sales Coach",
    tag: "real-time",
    text: "A live AI coach in every call — cues as your reps sell, then an after-call review and ELO score to make them better.",
    replaces: <>Replaces <b>Gong</b> — at a fraction of the price</>,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 12h2l2-5 3 10 3-13 2.5 8H20" />
      </svg>
    ),
  },
  {
    key: "finance",
    title: "Financial",
    tag: "the books",
    text: "Full double-entry accounting — GL, AP, AR, tax, banking, budgets — so your numbers live where the work does.",
    replaces: <>Replaces <b>QuickBooks / Xero</b></>,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="1.8" strokeLinecap="round">
        <path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" />
      </svg>
    ),
  },
];

// THE MODULES — platform breadth, one platform. Interactive grid (hover ignites the accent line).
export function Modules() {
  return (
    <section id="modules" className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.eyebrow}>One platform</div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className={styles.heading}>
            Everything your business runs on. <span className={styles.em}>In one place.</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sub}>Four products that share one brain — so the whole business finally adds up.</p>
        </Reveal>

        <div className={styles.grid}>
          {MODULES.map((m, i) => (
            <Reveal key={m.key} delay={140 + i * 90}>
              <div className={styles.card}>
                <div className={styles.icon} aria-hidden>{m.icon}</div>
                <div className={styles.title}>
                  {m.title}
                  <span>{m.tag}</span>
                </div>
                <div className={styles.text}>{m.text}</div>
                <div className={styles.replaces}>{m.replaces}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className={styles.connect}>
            One login. One system that connects them — a <b>support pattern</b> becomes a <b>coaching cue</b>{" "}
            becomes a <b>resolved problem</b>. That&apos;s something four separate tools can never do.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
