/**
 * Outside-Perspective Identification (CLAUDE.md §1.3).
 *
 * "Examine the problem as a detached observer with no stake in the existing
 *  assumptions, no sunk cost, no 'this is how we've always done it.' Actively
 *  counter tunnel vision."
 *
 * This module asks Claude to produce alternative readings of the same data,
 * with explicit instructions to challenge the framing the current read assumes.
 *
 * Critical: this is NOT the System telling the executive "here's what's really
 * happening" — that would overtake (§3.3). It's the System surfacing readings
 * the executive may not have considered, framed as questions, never assertions.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { OutsideViewReading } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type GenerateArgs = {
  /** What the user currently thinks is going on. */
  currentRead: string;
  /** The signals/patterns the current read is based on. */
  evidenceSummary: string;
  /** How many alternative readings to generate (default 3). */
  count?: number;
};

export async function generateOutsideViews(
  args: GenerateArgs
): Promise<OutsideViewReading[]> {
  const count = args.count ?? 3;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: `You are running CLAUDE.md §1.3 — Outside-Perspective Identification.

Your job is to generate ${count} alternative readings of the same situation, each
from a stance with NO investment in the user's current framing. You are actively
countering tunnel vision.

Rules:
- Each reading must CHALLENGE a specific assumption the current read takes for granted.
- Each reading must state what would have to be different IF this alternative were true.
- Do NOT recommend an action. Do NOT assert which reading is correct. This is §3.3.
- Do NOT pad with "I'm just speculating" disclaimers. State the alternative cleanly.

Return strict JSON:
{
  "readings": [
    {
      "framing": "How someone with no stake would describe this situation in one sentence.",
      "whatItChallenges": "The specific assumption in the current read that this challenges.",
      "ifTrueThen": "What would need to be different if this reading were correct."
    }
  ]
}

Generate exactly ${count} distinct readings. Distinct means they challenge DIFFERENT
assumptions — not three rewordings of the same idea.`,
    messages: [
      {
        role: "user",
        content: `Current read:
${args.currentRead}

Evidence summary:
${args.evidenceSummary}

Generate ${count} outside-view alternatives.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") return [];
  try {
    const parsed = JSON.parse(block.text);
    const readings = Array.isArray(parsed.readings) ? parsed.readings : [];
    return readings.slice(0, count);
  } catch {
    return [];
  }
}
