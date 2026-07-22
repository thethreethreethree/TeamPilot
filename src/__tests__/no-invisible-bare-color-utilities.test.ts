import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../../tailwind.config";

/**
 * Guard against the recurring "invisible element" class (audit F4 / V7 / C4, and the
 * 2026-07-22 `bg-brand` invisible-download-button incident).
 *
 * Tailwind only emits a BARE color utility (`bg-brand`, `text-ember`, `border-ink`) when
 * that color resolves to a usable value — a flat string, or a scale OBJECT that carries a
 * `DEFAULT` key. A scale object WITHOUT a DEFAULT (e.g. a raw 50–900 shade map) produces
 * NO rule for the bare utility, so the element renders with no background / no color and
 * becomes invisible. That is exactly what happened when `brand`/`ember` were scale objects
 * with no DEFAULT.
 *
 * This test uses Tailwind's OWN `resolveConfig` (not fragile hand-parsing) to check every
 * CUSTOM color that is actually used BARE in the codebase. It only flags project colors
 * (never Tailwind built-ins like `bg-white`), and only bare usages (never `bg-ember-400`),
 * so it can fail loudly without crying wolf. If it fails, either give the color a DEFAULT
 * in tailwind.config.ts, or use an explicit shade (`-400`) at the call site.
 */

const resolved = (resolveConfig(tailwindConfig as never) as never as {
  theme: Record<string, Record<string, unknown>>;
}).theme;

const extend = (tailwindConfig as never as {
  theme: { extend: Record<string, Record<string, unknown>> };
}).theme.extend;

// Utility prefix → the resolved theme namespace Tailwind pulls that color from. In
// resolveConfig output each of these already inherits from `colors` unless overridden.
const PREFIX_NS: Record<string, string> = {
  bg: "backgroundColor",
  text: "textColor",
  border: "borderColor",
  ring: "ringColor",
  divide: "divideColor",
  from: "gradientColorStops",
  via: "gradientColorStops",
  to: "gradientColorStops",
  fill: "fill",
  stroke: "stroke",
  caret: "caretColor",
  outline: "outlineColor",
  decoration: "textDecorationColor",
};

// PRECISELY the recurring class: a color registered in `colors` (so it LOOKS like a full
// color) that is a scale object without a DEFAULT — `bg-<name>` then emits nothing. We check
// ONLY names in `colors`, which is what makes this non-crying-wolf:
//   • `text-base` stays a font-size (base is NOT in colors — registered only on bg/border/ring),
//   • names defined solely in textColor/borderColor (secondary, muted, primary, accent-text,
//     default) are a different "wrong-namespace" concern, out of scope for THIS guard.
const customNames = Object.keys(extend.colors ?? {}).filter((n) => n !== "DEFAULT");

function resolvesBare(namespace: string, name: string): boolean {
  const v = resolved[namespace]?.[name];
  if (typeof v === "string") return true;
  if (v && typeof v === "object") return "DEFAULT" in (v as object);
  return false; // undefined (no such color) or a scale object without DEFAULT → bare utility emits nothing
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...walk(p));
    } else if (/\.(tsx?|jsx?|mdx)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("no invisible bare color utilities (recurring F4/V7/C4 class)", () => {
  it("every custom color used BARE resolves to real CSS (flat value or DEFAULT)", () => {
    const files = ["src/app", "src/components"].flatMap((r) => {
      try {
        return walk(r);
      } catch {
        return [];
      }
    });

    const offenders: string[] = [];
    const seen = new Set<string>();

    for (const prefix of Object.keys(PREFIX_NS)) {
      const ns = PREFIX_NS[prefix];
      for (const name of customNames) {
        // A BARE usage is `${prefix}-${name}` not followed by another `-segment` or word char
        // (which would make it a shade like `-400` or a longer color name).
        const re = new RegExp(`\\b${prefix}-${esc(name)}(?![-\\w])`);
        if (resolvesBare(ns, name)) continue; // resolves fine — nothing to check
        for (const file of files) {
          const src = readFileSync(file, "utf8");
          if (re.test(src)) {
            const key = `${prefix}-${name}`;
            if (!seen.has(key)) {
              seen.add(key);
              offenders.push(
                `${prefix}-${name}  (used bare in ${file} — ${ns}.${name} has no flat value/DEFAULT → renders nothing)`
              );
            }
          }
        }
      }
    }

    expect(
      offenders,
      `Bare color utilities that render NOTHING (invisible-element class). Add a DEFAULT to the color in ` +
        `tailwind.config.ts, or use an explicit shade at the call site:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
