import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProblemPatchSchema,
  DecisionCreateSchema,
  ResolutionPatchSchema,
} from "../validate";
import { INVITABLE_ROLES } from "@/lib/roles";

/**
 * Code-enum <-> DB-CHECK-constraint sync guard (same class as tagColors <-> 0035).
 *
 * A zod enum that validates API input before an insert must match the column's DB CHECK. If the
 * zod enum is MORE permissive, a value passes validation then fails the insert at runtime (a
 * confusing 500 instead of a clean 400); if LESS permissive, the API rejects values the DB stores.
 * Both are drift the DB CHECK comment never enforces. The DB CHECK is authoritative; this pins the
 * zod enums in validate.ts to their columns.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(here, "../../../../supabase/migrations");

/** zod introspection — a field may be a bare ZodEnum or an .optional()/.nullable() wrapper. */
function enumOptions(field: unknown): string[] {
  let node = field as {
    unwrap?: () => unknown;
    options?: readonly string[];
  };
  // Peel optional/nullable wrappers until we reach the ZodEnum that carries .options.
  for (let i = 0; i < 5 && !node.options && typeof node.unwrap === "function"; i++) {
    node = node.unwrap() as typeof node;
  }
  return [...(node.options ?? [])];
}

/** The `col in ('a','b',...)` CHECK list from the migration whose filename starts with `prefix`. */
function dbCheck(prefix: string, column: string): string[] {
  const file = readdirSync(MIG_DIR).find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`migration ${prefix}* not found`);
  const sql = readFileSync(join(MIG_DIR, file), "utf8");
  const m = sql.match(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]+)\\)`, "i"));
  return (m?.[1] ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

const PAIRS = [
  {
    name: "problems.status (ProblemPatchSchema.status <-> 0002)",
    zod: enumOptions(ProblemPatchSchema.shape.status),
    db: dbCheck("0002", "status"),
  },
  {
    name: "decision_dialogues.chosen_path (DecisionCreateSchema.chosenPath <-> 0003)",
    zod: enumOptions(DecisionCreateSchema.shape.chosenPath),
    db: dbCheck("0003", "chosen_path"),
  },
  {
    name: "resolutions.durability (ResolutionPatchSchema.durability <-> 0005)",
    zod: enumOptions(ResolutionPatchSchema.shape.durability),
    db: dbCheck("0005", "durability"),
  },
  {
    // The LIVE role list isInvitableRole() gates team invites with (roles.ts), which its own
    // comment says maps to team_invitations.role. A drift = a role the invite accepts fails the
    // DB CHECK on insert (privilege-relevant path).
    name: "team_invitations.role (INVITABLE_ROLES <-> 0008)",
    zod: [...INVITABLE_ROLES],
    db: dbCheck("0008", "role"),
  },
];

describe("validate.ts enums stay in sync with their DB CHECK constraints", () => {
  for (const p of PAIRS) {
    it(`${p.name} — both non-empty`, () => {
      expect(p.zod.length, "zod enum").toBeGreaterThan(0);
      expect(p.db.length, "db CHECK").toBeGreaterThan(0);
    });
    it(`${p.name} — zod enum equals the DB CHECK set (drift = runtime insert failure)`, () => {
      expect([...p.zod].sort()).toEqual([...p.db].sort());
    });
  }
});
