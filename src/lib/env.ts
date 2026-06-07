import "server-only";
import { z } from "zod";

/**
 * Env validation (audit Tier 1 #6).
 *
 * Validates the server-side environment at first import. A misconfigured
 * `.env.local` fails here with a clear message instead of producing confusing
 * runtime errors deep in the LLM or DB path.
 *
 * Constraints encoded:
 *   - In production, at least one LLM provider key MUST be set
 *   - DEEPSEEK_API_KEY should match the `sk-` prefix if set
 *   - ANTHROPIC_API_KEY should match the `sk-ant-` prefix if set
 *   - Supabase URL must look like a URL when set
 *   - LLM_PROVIDER, if set, must be a known value
 *
 * In demo mode (no Supabase, no LLM keys) the validator passes — we want the
 * UI to be browsable. The strict check only kicks in for production.
 */

const Env = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    EXECOS_ALLOW_SEED: z
      .union([z.literal("true"), z.literal("false")])
      .optional(),

    // LLM providers — at least one in production
    DEEPSEEK_API_KEY: z
      .string()
      .regex(/^sk-/, "DEEPSEEK_API_KEY should start with 'sk-'")
      .optional()
      .or(z.literal("")),
    DEEPSEEK_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: z
      .string()
      .regex(/^sk-ant-/, "ANTHROPIC_API_KEY should start with 'sk-ant-'")
      .optional()
      .or(z.literal("")),
    ANTHROPIC_MODEL: z.string().optional(),
    LLM_PROVIDER: z
      .enum(["deepseek", "anthropic"])
      .optional()
      .or(z.literal("")),

    // Supabase (client-readable but parsed here for consistency)
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
      .optional()
      .or(z.literal("")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      const hasDeepseek = Boolean(env.DEEPSEEK_API_KEY);
      const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
      if (!hasDeepseek && !hasAnthropic) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DEEPSEEK_API_KEY"],
          message:
            "Production requires at least one LLM provider key. Set DEEPSEEK_API_KEY (primary) or ANTHROPIC_API_KEY (alternate).",
        });
      }
      const hasUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL);
      const hasAnon = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      if (hasUrl !== hasAnon) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
          message:
            "Supabase URL and anon key must be set together (you set one but not the other).",
        });
      }
    }
  });

const parsed = Env.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // Fail loudly. The Next.js dev server will surface this stack trace clearly.
  throw new Error(
    `\n[ELOSTATE] Environment validation failed:\n${issues}\n\nFix the values in .env.local (or your deployment env), then restart.\n`
  );
}

export const env = parsed.data;

// Convenience flags consumed by other modules. These replace the old
// `process.env.X` checks scattered through the codebase.
export const hasDeepseek = Boolean(env.DEEPSEEK_API_KEY);
export const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
export const hasSupabase = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
