import { describe, it, expect } from "vitest";
import { toCsv } from "../toCsv";

/**
 * toCsv is the RFC-4180 writer behind every CSV export. Two things must hold or exports break/leak: correct
 * quoting/escaping (a bug corrupts every downloaded file), and formula-injection neutralization applied to each
 * DATA cell (CWE-1236 — a cell like =HYPERLINK("http://evil") runs when a teammate opens the file). csvSafe's
 * neutralizer is unit-tested separately; this pins that toCsv actually RUNS it on data cells (not headers) and
 * that the quoting is correct — the pure logic was untested (found via a function-level coverage survey).
 */

describe("toCsv — RFC 4180 quoting", () => {
  it("writes a header + rows, CRLF-terminated", () => {
    expect(toCsv([{ a: "1", b: "2" }])).toBe("a,b\r\n1,2\r\n");
  });

  it("quotes fields with comma / newline, and doubles embedded quotes", () => {
    expect(toCsv([{ a: "x,y" }])).toBe('a\r\n"x,y"\r\n');
    expect(toCsv([{ a: 'he said "hi"' }])).toBe('a\r\n"he said ""hi"""\r\n');
    expect(toCsv([{ a: "line1\nline2" }])).toBe('a\r\n"line1\nline2"\r\n');
  });

  it("null/undefined → empty field; numbers/booleans stringified", () => {
    expect(toCsv([{ a: null, b: undefined, c: 5, d: true }])).toBe("a,b,c,d\r\n,,5,true\r\n");
  });

  it("objects/arrays → JSON (quoted because the JSON contains quotes)", () => {
    expect(toCsv([{ a: { x: 1 } }])).toBe('a\r\n"{""x"":1}"\r\n');
  });

  it("uses the columns param for order + selection", () => {
    expect(toCsv([{ a: "1", b: "2", c: "3" }], ["c", "a"])).toBe("c,a\r\n3,1\r\n");
  });

  it("empty rows → just the header line from the columns param", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b\r\n");
  });
});

describe("toCsv — formula-injection safety (CWE-1236)", () => {
  it("neutralizes a =HYPERLINK data cell with a leading apostrophe (then quotes it)", () => {
    const out = toCsv([{ a: '=HYPERLINK("http://evil","x")' }]);
    expect(out).toContain(`"'=HYPERLINK`); // apostrophe-prefixed, then RFC-quoted for the comma/quotes
  });

  it("neutralizes @ / + lead formulas too", () => {
    expect(toCsv([{ a: "@SUM(1)" }])).toBe("a\r\n'@SUM(1)\r\n"); // no comma → apostrophe only, no quotes
    expect(toCsv([{ a: "+1+2" }])).toBe("a\r\n'+1+2\r\n");
  });

  it("does NOT neutralize a well-formed negative number (stays numeric)", () => {
    expect(toCsv([{ a: "-5" }])).toBe("a\r\n-5\r\n");
    expect(toCsv([{ a: "-5.25" }])).toBe("a\r\n-5.25\r\n");
  });
});
