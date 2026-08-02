import Link from "next/link";
import { Bulb } from "./Bulb";
import { CTA } from "./brand";
import styles from "./Footer.module.css";

// FOOTER — clean, minimal, links + brand. Preserves the real routes the app already serves.
export function Footer() {
  const year = 2026;
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.brand} aria-label="Elostate — home">
              <Bulb size={28} />
              <span className={styles.word}>ELOSTATE</span>
            </Link>
            <p className={styles.tagline}>Where simplicity meets productivity — built by business owners just like you.</p>
          </div>

          <div className={styles.links}>
            <div className={styles.col}>
              <div className={styles.colHead}>Product</div>
              <Link href="#modules" className={styles.link}>Platform</Link>
              <Link href="#differentiator" className={styles.link}>How it works</Link>
              <Link href="/pitch" className={styles.link}>See it work</Link>
            </div>
            <div className={styles.col}>
              <div className={styles.colHead}>Get started</div>
              <Link href={CTA.primaryHref} className={styles.link}>Request access</Link>
              <Link href={CTA.signInHref} className={styles.link}>Sign in</Link>
              <Link href="/help" className={styles.link}>Help</Link>
            </div>
            <div className={styles.col}>
              <div className={styles.colHead}>Company</div>
              <Link href="/privacy" className={styles.link}>Privacy</Link>
              <Link href="/terms" className={styles.link}>Terms</Link>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.copy}>© {year} Elostate. All rights reserved.</div>
          <Link href={CTA.primaryHref} className={styles.pill}>{CTA.primaryLabel}</Link>
        </div>
      </div>
    </footer>
  );
}
