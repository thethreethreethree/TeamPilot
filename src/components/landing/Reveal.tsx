"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Reveal.module.css";

// Wrap any block to reveal it as it scrolls into view. Robust by design: the content ships
// visible; JS only "arms" the hidden-then-reveal behavior when it's actually running, so a
// no-JS or reduced-motion visitor always sees the content.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const armed = styles.armed;
    const inCls = styles.in;
    if (armed) el.classList.add(armed);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (inCls) el.classList.add(inCls);
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
