import "server-only";

import { llmCall } from "@/lib/llm";
import { runBrainCall } from "@/lib/brain";
import type { RippleEffect } from "./types";

/**
 * Ripple-Trace — holistic affected-systems analysis (§1.5, §2).
 */

type TraceArgs = {
  problemTitle: string;
  diagnosis: string;
  candidateAction: string;
  contextSummary: string;
  companyId?: string;
};

const SYSTEM_PROMPT = `You are running §1.5 — Holistic Ripple-Trace.

You are given a problem and a candidate action. Your job is to enumerate every
subject (task, person, process, signal stream, downstream dependency) that this
action would affect — beyond the immediate target.

Rules:
- Each ripple must name a specific affected subject.
- Each ripple must state what happens to that subject IF this action is taken.
- Each ripple must carry an explicit WHY — the reasoning chain from action to effect.
- Mark confidence as high/medium/low honestly.
- Do NOT recommend whether to take the action.

Return strict JSON:
{
  "ripples": [
    { "affectedSubject": "...", "effect": "...", "confidence": "high|medium|low", "reasoning": "..." }
  ]
}

If you cannot identify any meaningful ripples, return { "ripples": [] }. Do not
invent ripples to look thorough.`;

export async function traceRipples(args: TraceArgs): Promise<RippleEffect[]> {
  const userContent = `Problem: ${args.problemTitle}

Diagnosis (the earned WHY):
${args.diagnosis}

Candidate action:
${args.candidateAction}

Context (signals + adjacent state):
${args.contextSummary}`;

  let text = "";
  if (args.companyId) {
    const r = await runBrainCall({
      companyId: args.companyId,
      basePrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 1000,
      expectJson: true,
    });
    if (!r.gate.guidanceEnabled) return [];
    text = r.text;
  } else {
    const r = await llmCall({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 1000,
      expectJson: true,
    });
    text = r.text;
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.ripples) ? parsed.ripples : [];
  } catch {
    return [];
  }
}
