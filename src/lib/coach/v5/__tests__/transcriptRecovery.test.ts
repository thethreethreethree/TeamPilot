import { describe, it, expect } from "vitest";
import { answerableSpeaker,
  stateOf,
  isRecoverable,
  mayOverwriteUnlabelled,
  labelFor,
} from "../transcriptRecovery";

/**
 * transcriptRecovery — the rules that decide whether a call's saved audio can still
 * rescue its transcript, and what the recovered words are allowed to be called.
 *
 * These lock the exact production failure of 10 September 2026: nine sessions holding
 * saved audio and NO transcript, none of which any recovery path would accept, because
 * both existing paths keyed on a transcript that already had content.
 */

const seg = (speaker: "agent" | "customer" | "unknown") => ({ speaker });

describe("isRecoverable — a transcript missing an entire SIDE can still be improved", () => {
  it("accepts a BLANK transcript — the nine-session production failure", () => {
    // The precise case /auto-recover used to refuse: computeTalkRatio([]) is null, so its
    // caveat precondition answered "not-applicable" and nothing ever tried.
    expect(isRecoverable(stateOf([]))).toBe(true);
  });

  it("accepts an UNKNOWN-only transcript — words saved, nobody attributed them", () => {
    expect(isRecoverable(stateOf([seg("unknown"), seg("unknown")]))).toBe(true);
  });

  it("REFUSES a customer-only transcript, protecting a rep's answer at a known cost", () => {
    /*
      Found by walking what a rep actually does with the picker. When they answer "that was
      the customer, not me" — the one-sided capture the picker exists for — every segment
      becomes `customer`. The first rule here was "zero agent turns means recoverable", so
      the sweep would have overwritten their deliberate answer within the hour. The system
      would have argued with the person it asked.

      THE COST, because this test used to be named as if there were none. Customer-only is
      NOT only ever a human answer: production holds six such transcripts from 23 July to
      18 August, all predating the answer flow, where live capture attributed the customer
      and never attributed the rep. So this rule also refuses a genuine capture gap.

      It is safe today because every one of those six has NO saved audio, and the sweep only
      ever considers sessions that have some. The trade is deliberate: skipping a re-read is
      a smaller mistake than overwriting an answer somebody gave.
    */
    expect(isRecoverable(stateOf([seg("customer"), seg("customer")]))).toBe(false);
  });

  it("still accepts a customer-only transcript that has UNKNOWN turns left in it", () => {
    // No answer has been given here — the unknowns are the proof of that.
    expect(isRecoverable(stateOf([seg("customer"), seg("unknown")]))).toBe(true);
  });

  it("accepts an AGENT-only transcript — the original customer-missing capture gap", () => {
    expect(isRecoverable(stateOf([seg("agent"), seg("agent")]))).toBe(true);
  });

  it("REFUSES a two-sided transcript — canonical speech is never clobbered", () => {
    // The guard that stops recovery becoming a second opinion that overwrites real
    // captured speech on a call that needed nothing.
    expect(isRecoverable(stateOf([seg("agent"), seg("customer")]))).toBe(false);
  });

  it("refuses a two-sided transcript even when unknown turns are mixed in", () => {
    expect(isRecoverable(stateOf([seg("agent"), seg("unknown"), seg("customer")]))).toBe(false);
  });
});

describe("mayOverwriteUnlabelled — what a DECLINED assignment is allowed to replace", () => {
  it("allows overwriting a blank transcript — there is nothing to lose", () => {
    expect(mayOverwriteUnlabelled(stateOf([]))).toBe(true);
  });

  it("allows overwriting an unknown-only transcript", () => {
    expect(mayOverwriteUnlabelled(stateOf([seg("unknown")]))).toBe(true);
  });

  it("REFUSES to overwrite a rep's customer-only answer with an unlabelled re-read", () => {
    expect(mayOverwriteUnlabelled(stateOf([seg("customer"), seg("customer")]))).toBe(false);
  });

  it("REFUSES to overwrite real agent speech with an unlabelled re-read", () => {
    // A one-sided transcript still holds genuinely attributed rep speech. Replacing it
    // with `unknown` segments would trade a partial record for a worse one.
    expect(mayOverwriteUnlabelled(stateOf([seg("agent"), seg("agent")]))).toBe(false);
  });

  it("refuses even when a single agent turn sits among many unknowns", () => {
    expect(
      mayOverwriteUnlabelled(stateOf([seg("unknown"), seg("unknown"), seg("agent")]))
    ).toBe(false);
  });
});

describe("labelFor — attribution is never invented", () => {
  it("labels UNKNOWN when no cluster was assigned — the founder's 'save unlabelled' rule", () => {
    // The whole point: the words are still written. A confident wrong label would put the
    // wrong voice under every coaching score; `unknown` puts none there and loses nothing.
    expect(labelFor("speaker_0", null)).toBe("unknown");
    expect(labelFor("speaker_1", null)).toBe("unknown");
  });

  it("labels the assigned cluster AGENT and every other cluster CUSTOMER", () => {
    expect(labelFor("speaker_1", "speaker_1")).toBe("agent");
    expect(labelFor("speaker_0", "speaker_1")).toBe("customer");
    expect(labelFor("speaker_2", "speaker_1")).toBe("customer");
  });
});

describe("stateOf — the counts the decisions read", () => {
  it("counts each side and counts the unknowns separately", () => {
    const s = stateOf([seg("agent"), seg("unknown"), seg("customer"), seg("customer")]);
    expect(s).toEqual({ total: 4, agent: 1, customer: 2, unknown: 1 });
  });

  it("an empty transcript is a total of zero, not an absent reading", () => {
    expect(stateOf([])).toEqual({ total: 0, agent: 0, customer: 0, unknown: 0 });
  });
});

/**
 * answerableSpeaker — whose answer is this transcript still waiting for?
 *
 * The sweep must never overrule a rep; a rep must be able to overrule the machine. These pin the line
 * between those two, which is `source`, not the label. Measured on production 2026-09-10: of 2,414 stored
 * segments not one carries `source: "manual"`, so every label in the database today is a machine's guess.
 */
describe("answerableSpeaker", () => {
  const seg = (speaker: string, source?: string | null) =>
    ({ speaker, source }) as Parameters<typeof answerableSpeaker>[0][number];

  it("an all-unknown transcript is answerable (the original case)", () => {
    expect(answerableSpeaker([seg("unknown"), seg("unknown")])).toEqual({
      answerable: true,
      currentSpeaker: "unknown",
    });
  });

  it("an all-CUSTOMER machine transcript is answerable — this is what was unfixable before", () => {
    expect(answerableSpeaker([seg("customer", "loudness"), seg("customer", "loudness")])).toEqual({
      answerable: true,
      currentSpeaker: "customer",
    });
  });

  it("an all-AGENT machine transcript is answerable too — the mistake runs both ways", () => {
    expect(answerableSpeaker([seg("agent", "content")])).toEqual({
      answerable: true,
      currentSpeaker: "agent",
    });
  });

  it("ONE manual segment makes the whole transcript unanswerable — a person already spoke", () => {
    expect(answerableSpeaker([seg("customer", "loudness"), seg("customer", "manual")])).toEqual({
      answerable: false,
      reason: "already-answered",
    });
  });

  it("two voices is canonical and refused, whatever wrote them", () => {
    expect(answerableSpeaker([seg("agent", "loudness"), seg("customer", "loudness")])).toEqual({
      answerable: false,
      reason: "two-sided",
    });
  });

  it("a mix of unknown and a label is refused too — it is no longer one voice", () => {
    expect(answerableSpeaker([seg("unknown"), seg("customer", "loudness")])).toEqual({
      answerable: false,
      reason: "two-sided",
    });
  });

  it("an empty transcript has nothing to answer", () => {
    expect(answerableSpeaker([])).toEqual({ answerable: false, reason: "no-transcript" });
  });

  it("a missing source is not a human answer — an absent field never means somebody spoke", () => {
    expect(answerableSpeaker([seg("customer", null), seg("customer", undefined)])).toEqual({
      answerable: true,
      currentSpeaker: "customer",
    });
  });
});
