/**
 * Shared source/migration scanning helpers for the static-reference consistency guards
 * (clientFetchRoutes / navHrefPages / fromTablesExist / rpcFunctionsExist). Not a test itself
 * (no `.test.ts` suffix, so vitest's `**\/*.test.ts` include skips it) — just reused by them so
 * the file-walk isn't copy-pasted four ways.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "__tests__" || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

/** Repo `src/` dir (this file lives at src/lib/__tests__/, so up two). */
export const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MIGRATIONS_DIR = join(SRC_DIR, "..", "supabase", "migrations");

/** All .ts/.tsx under the given src subdirs (default app/components/lib), excluding __tests__. */
export function scanSourceFiles(subdirs: string[] = ["app", "components", "lib"]): string[] {
  return subdirs.flatMap((d) => {
    const dir = join(SRC_DIR, d);
    return existsSync(dir) ? walk(dir) : [];
  });
}

/** Distinct capture-group-1 matches of `re` (must be global) across all scanned source files. */
export function collectMatches(re: RegExp, subdirs?: string[]): Set<string> {
  const out = new Set<string>();
  for (const f of scanSourceFiles(subdirs)) {
    for (const m of readFileSync(f, "utf8").matchAll(re)) {
      if (m[1]) out.add(m[1]);
    }
  }
  return out;
}

/** Concatenated SQL of every migration. */
export function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}
