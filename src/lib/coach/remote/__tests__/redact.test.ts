import { describe, it, expect } from "vitest";
import { REDACTED, redactNumbers } from "../redact";

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
