import Link from "next/link";
import { Reveal } from "./Reveal";
import { Bulb } from "./Bulb";
import { CTA } from "./brand";
import styles from "./Close.module.css";

// THE CLOSE — confident final CTA. Restate the outcome, remove the risk (prove it in your own data),
// one strong button.
export function Close() {
  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.bulb}>
            <Bulb size={72} pulse />
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className={styles.heading}>
            Make your team <span className={styles.em}>think.</span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className={styles.sub}>
            Start with a baseline. Watch the lift show up in your own numbers. There&apos;s no leap of faith —
            the proof is yours from day one.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className={styles.cta}>
            <Link href={CTA.primaryHref} className={styles.btn}>{CTA.primaryLabel}</Link>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <p className={styles.reassure}>
            Built by business owners just like you. <b>We prove it in your data — or we don&apos;t deserve the seat.</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
