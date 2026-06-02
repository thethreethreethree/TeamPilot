import "server-only";

import { llmCall } from "@/lib/llm";
import { runBrainCall } from "@/lib/brain";
import type { OutsideViewReading } from "./types";

/**
 * Outside-Perspective Identification (CLAUDE.md §1.3).
 *
 * Generates alternative readings via the configured provider (DeepSeek primary),
 * routed through the brain when a companyId is provided so the per-company
 * style addendum applies — without ever overriding the §1.3 instruction to
 * challenge the user's existing assumptions (the discipline reminder appended
 * to every brain-composed prompt prevents echo-chamber drift).
 */

type GenerateArgs = {
  currentRead: string;
  evidenceSummary: string;
  count?: number;
  companyId?: string;
};

const SYSTEM_PROMPT = (count: number) => `You are running CLAUDE.md §1.3 — Outside-Perspective Identification.

Your job is to generate ${count} alternative readings of the same situation, each
from a stance with NO investment in the user's current framing. You are actively
countering tunnel vision.

Rules:
- Each reading must CHALLENGE a specific assumption the current read takes for granted.
- Each reading must state what would have to be different IF this alternative were true.
- Do NOT recommend an action. Do NOT assert which reading is correct.
- Do NOT pad with "I'm just speculating" disclaimers.

Return strict JSON:
{
  "readings": [
    { "framing": "...", "whatItChallenges": "...", "ifTrueThen": "..." }
  ]
}

Generate exactly ${count} distinct readings. Distinct means they challenge DIFFERENT
assumptions.`;

export async function generateOutsideViews(
  args: GenerateArgs
): Promise<OutsideViewReading[]> {
  const count = args.count ?? 3;
  const systemPrompt = SYSTEM_PROMPT(count);
  const userContent = `Current read:
${args.currentRead}

Evidence summary:
${args.evidenceSummary}

Generate ${count} outside-view alternatives.`;

  let text = "";
  if (args.companyId) {
    const r = await runBrainCall({
      companyId: args.companyId,
      basePrompt: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 900,
      expectJson: true,
    });
    if (!r.gate.guidanceEnabled) return [];
    text = r.text;
  } else {
    const r = await llmCall({
      systemPrompt,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 900,
      expectJson: true,
    });
    text = r.text;
  }

  try {
    const parsed = JSON.parse(text);
    const readings = Array.isArray(parsed.readings) ? parsed.readings : [];
    return readings.slice(0, count);
  } catch {
    return [];
  }
}
