/**
 * Ripple-Trace — holistic affected-systems analysis (CLAUDE.md §1.5, §2).
 *
 * "Before any change touching shared state, schema, or cross-module behavior,
 *  state what else it affects. Holistic over local."
 *
 * Given a candidate resolution, this module asks Claude to enumerate everything
 * that ripples — what tasks, people, processes, or signals are affected, with
 * confidence and reasoning. Each ripple carries an explicit WHY (Rule 2).
 *
 * The output is consumed by the diagnosis UI to surface ripples BEFORE the
 * resolution is committed. This is the structural protection against "fixed
 * one thing, silently broke another."
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RippleEffect } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type TraceArgs = {
  problemTitle: string;
  diagnosis: string;
  candidateAction: string;
  contextSummary: string; // signals + adjacent state the user has surfaced
};

export async function traceRipples(args: TraceArgs): Promise<RippleEffect[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: `You are running CLAUDE.md §1.5 — Holistic Ripple-Trace.

You are given a problem and a candidate action. Your job is to enumerate every
subject (task, person, process, signal stream, downstream dependency) that this
action would affect — beyond the immediate target.

Rules:
- Each ripple must name a specific affected subject.
- Each ripple must state what happens to that subject IF this action is taken.
- Each ripple must carry an explicit WHY — the reasoning chain from action to
  effect. A ripple without a WHY is incomplete (Rule 2).
- Mark confidence as high/medium/low honestly. Low confidence is correct when
  the chain is plausible but unverified.
- Do NOT recommend whether to take the action. That belongs to the user.
- Do NOT pad with "this is just a prediction" — say it once, then state the ripples.

Return strict JSON:
{
  "ripples": [
    {
      "affectedSubject": "what is affected (be specific — name the task/person/process)",
      "effect": "what happens to it",
      "confidence": "high|medium|low",
      "reasoning": "the WHY — the chain from action to effect"
    }
  ]
}

If you cannot identify any meaningful ripples, return { "ripples": [] } — empty is
correct when the action is genuinely contained. Do not invent ripples to look thorough.`,
    messages: [
      {
        role: "user",
        content: `Problem: ${args.problemTitle}

Diagnosis (the earned WHY):
${args.diagnosis}

Candidate action:
${args.candidateAction}

Context (signals + adjacent state):
${args.contextSummary}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") return [];
  try {
    const parsed = JSON.parse(block.text);
    return Array.isArray(parsed.ripples) ? parsed.ripples : [];
  } catch {
    return [];
  }
}
