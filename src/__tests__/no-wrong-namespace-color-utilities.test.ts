import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../../tailwind.config";

/**
 * The WRONG-NAMESPACE guard — the sibling `no-invisible-bare-color-utilities.test.ts` says it is
 * missing.
 *
 * That test's own comment: "names defined solely in textColor/borderColor (secondary, muted,
 * primary, accent-text, default) are a different 'wrong-namespace' concern, out of scope for THIS
 * guard." This is that guard.
 *
 * THE CLASS. This project registers its semantic tokens on PER-PROPERTY scales, not on top-level
 * `colors` — deliberately, because a color named `base` on `colors` collides with the `text-base`
 * FONT-SIZE utility and once turned every `text-base` element's text the colour of the page
 * background (V7, 2026-07-22). The cost of that correct decision is that a token is only valid for
 * the properties it was registered on. `text-primary` existing does NOT mean `bg-primary`,
 * `stroke-primary` or `border-primary` exist.
 *
 * WHY IT NEEDS A TEST. When the utility does not exist, Tailwind emits no rule. Nothing throws.
 * `tsc` is happy — it is a string. ESLint is happy. The class name is still on the element in
 * devtools, which makes it look applied. The element simply renders with no fill, and an element
 * with no fill looks exactly like an element that was not supposed to have one.
 *
 * Found 2026-09-24 by rendering: `stroke-primary` meant MyProgress's trend line had never been
 * drawn in either theme, and 25 `bg-*` uses were invisible status dots, 1px rules, a toggle knob
 * and a chip tint. The dots are the sharpest example — each sat beside a `bg-emerald-400` "on"
 * state as the "off" state, so the off state rendered as empty space.
 *
 * SCOPE. `bg-` only, by the founder's decision on 2026-09-24, and the exclusions are listed rather
 * than assumed:
 *
 *   • `text-strong` (18 uses, 3 files) — a no-op that inherits its parent colour, which is what
 *     those screens were reviewed and approved looking like. Making it resolve would CHANGE 18
 *     places, so it is deliberately out.
 *   • `border-primary` (2) and `border-accent-text` (10) — same reasoning, unexamined.
 *
 * Those are real members of the class. They are named here so the exclusion is visible: a guard
 * that silently covers part of a class is how a class gets believed to be closed.
 */

const resolved = (resolveConfig(tailwindConfig as never) as never as {
  theme: Record<string, Record<string, unknown>>;
}).theme;

const extend = (tailwindConfig as never as {
  theme: { extend: Record<string, Record<string, unknown>> };
}).theme.extend;

/**
 * Every token name this project registers on a per-property scale rather than on `colors`. These
 * are precisely the names that are valid for some properties and not others.
 */
const SCOPED_NAMES = [...new Set(
  ["backgroundColor", "textColor", "borderColor", "ringColor", "divideColor", "stroke", "fill"]
    .flatMap((ns) => Object.keys(extend[ns] ?? {}))
    .filter((name) => name !== "DEFAULT" && !(name in (extend.colors ?? {})))
)];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...walk(p));
    } else if (/\.(tsx?|jsx?|mdx)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

describe("no wrong-namespace color utilities (bg-)", () => {
  it("sanity: the guard has token names to check", () => {
    expect(SCOPED_NAMES.length).toBeGreaterThan(0);
  });

  it("every `bg-<token>` used in the codebase resolves to real CSS", () => {
    const files = ["src/app", "src/components", "src/lib"].flatMap((r) => {
      try {
        return walk(r);
      } catch {
        return [];
      }
    });

    // Precompute only the names that DON'T resolve, so each file is read once.
    const suspects = SCOPED_NAMES.filter(
      (name) => resolved.backgroundColor?.[name] === undefined
    ).map((name) => ({
      name,
      // `(/\d+)?` because an opacity modifier does not rescue it: `bg-primary/15` needs
      // `primary` in the backgroundColor namespace exactly as `bg-primary` does.
      re: new RegExp(`\\bbg-${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/\\d+)?(?![-\\w])`),
    }));

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const s of suspects) {
        if (s.re.test(src)) {
          offenders.push(`bg-${s.name} in ${file.replace(/\\/g, "/")}`);
        }
      }
    }

    expect(
      offenders,
      "These `bg-` utilities DO NOT EXIST — Tailwind emits no rule for them, so the element " +
        "renders with no fill while the class name still appears in the DOM. Either register the " +
        "token on `backgroundColor` in tailwind.config.ts, or use a utility that exists:\n" +
        offenders.join("\n")
    ).toEqual([]);
  });
});
