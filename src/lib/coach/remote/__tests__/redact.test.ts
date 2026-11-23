import { describe, it, expect } from "vitest";
import { isCounting, REDACTED, redactNumbers, redactSpokenNumbers, spokenDigitCount, transcriptTextForStorage } from "../redact";

/** D15 number redaction: removes long digit runs as people read them out; leaves ordinary numbers alone. */
describe("redactNumbers", () => {
  it("removes a card number read in groups, an SSN and an account number", () => {
    expect(redactNumbers("my card is 4111 1111 1111 1111 thanks", 9)).toBe(`my card is ${REDACTED} thanks`);
    expect(redactNumbers("social is 123-45-6789", 9)).toBe(`social is ${REDACTED}`);
    expect(redactNumbers("account 0012345678.", 9)).toBe(`account ${REDACTED}.`);
  });
  it("leaves prices, years, times and short counts alone", () => {
    const s = "It's $89.99 a month since 2024, call at 3:30, 2 lines";
    expect(redactNumbers(s, 9)).toBe(s);
  });
  it("respects the chosen length", () => {
    expect(redactNumbers("call 555 123 4567", 9)).toBe(`call ${REDACTED}`); // a phone number is 10 digits
    expect(redactNumbers("call 555 123 4567", 13)).toBe("call 555 123 4567"); // card-length only keeps it
  });
  it("does nothing when switched off (minDigits < 1) or on empty text", () => {
    expect(redactNumbers("4111111111111111", 0)).toBe("4111111111111111");
    expect(redactNumbers("", 9)).toBe("");
  });
});

describe("numbers spoken as words (2026-11-23)", () => {
  it("counts the digits a run of number words stands for", () => {
    expect(spokenDigitCount("four one one one")).toBe(4);
    expect(spokenDigitCount("double five")).toBe(2);
    expect(spokenDigitCount("forty one eleven")).toBe(4);
    expect(spokenDigitCount("thirty oh")).toBe(3); // "thirty" then a separate "oh" (0)
    expect(spokenDigitCount("4111 one one")).toBe(6);
  });
  it("a card or account number read out in words is removed", () => {
    expect(redactSpokenNumbers("my card is four one one one, one one one one, one one one one, one one one one thanks", 9)).toBe("my card is [number removed] thanks");
    expect(redactSpokenNumbers("it's 4111 one one one one one one one ok", 9)).toBe("it's [number removed] ok");
    expect(redactSpokenNumbers("social is five two one - four seven - eight eight three one", 9)).toBe("social is [number removed]");
    expect(redactSpokenNumbers("account double five triple two forty one eleven", 9)).toBe("account [number removed]");
  });
  it("ordinary speech is left alone", () => {
    for (const t of [
      "one or two bedrooms",
      "I'll call you at two thirty",
      "we have three kids, two dogs",
      "oh one more thing",
      "that's fifty nine ninety nine a month",
      "two thousand twenty six",
      "someone, anyone, everyone",
      // production 2026-11-23: someone counting is not reading out a number
      "twenty-one, twenty-two, twenty-three, twenty-four, twenty-five, twenty-six, twenty-seven, twenty-eight, twenty-nine, thirty, thirty-one",
      "testing one two three four five six seven eight nine ten",
      "ten nine eight seven six five four three two one",
    ]) expect(redactSpokenNumbers(t, 9)).toBe(t);
  });
  it("counting moves one way by 1 to 3; a card read in pairs or digit by digit does not", () => {
    expect(isCounting("twenty-one, twenty-two, twenty-three")).toBe(true);
    expect(isCounting("twenty-one, twenty-two, twenty-four, twenty-six, twenty-seven, thirty")).toBe(true); // production shape: skips
    expect(isCounting("four one one one one one one one")).toBe(false); // repeats
    expect(isCounting("five two one four seven eight eight three one")).toBe(false);
    expect(isCounting("forty one, eleven, eleven, eleven")).toBe(false);
    expect(isCounting("one two three five")).toBe(true); // small skips still count; 9+ digits only rising by 1–3 is no real id
    expect(isCounting("one two three one")).toBe(false); // turns back
    expect(isCounting("double five six seven")).toBe(false);
    expect(redactSpokenNumbers("it's forty one, eleven, eleven, eleven, eleven, eleven, eleven, eleven", 9)).toBe("it's [number removed]");
  });
  it("stored text gets both passes", () => {
    expect(transcriptTextForStorage("card four one one one one one one one one and 4111 1111 1111 1111")).toBe("card [number removed] and [number removed]");
  });
});
