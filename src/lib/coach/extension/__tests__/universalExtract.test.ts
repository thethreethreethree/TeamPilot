import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Behavioral test for universalExtract — the site-agnostic auto-capture heuristic built for Instagram
 * (founder: "we can not differ from the original system feature"). It's RUNTIME-UNVERIFIED (page DOM, no
 * browser), so this locks the one piece that's pure logic: group visible [dir="auto"] nodes by their nearest
 * scrollable ancestor and return the DENSEST region (the thread scrolls and holds the most text; the sidebar
 * is a different, smaller scroll region). Detection-true: if the density selection breaks (picks the first or
 * the smallest region), the thread-vs-sidebar test fails.
 *
 * Loaded in a vm with a mocked DOM (the codebase pattern from the adapters tests). We mock only the DOM APIs
 * universalExtract touches: querySelectorAll, getComputedStyle, body, and node offsetParent/getClientRects/
 * innerText/parentElement/scrollHeight/clientHeight.
 */

const ADAPTERS = readFileSync(
  join(process.cwd(), "extension-sales", "adapters.js"),
  "utf-8"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

function loadUniversalExtract(opts: {
  autos: Node[];
  body: Node;
  overflowByNode: Map<Node, string>;
  fallback?: Node[];
}) {
  const document = {
    body: opts.body,
    querySelectorAll: (sel: string) => {
      if (sel === '[dir="auto"]') return opts.autos;
      return opts.fallback ?? [];
    },
  };
  const getComputedStyle = (el: Node) => ({ overflowY: opts.overflowByNode.get(el) ?? "visible" });
  const ctx: Record<string, unknown> = { document, getComputedStyle, console };
  vm.createContext(ctx);
  vm.runInContext(ADAPTERS, ctx);
  return (ctx as { universalExtract: () => string }).universalExtract;
}

// A scrollable container node (its own scroll region).
function region(body: Node): Node {
  return { parentElement: body, scrollHeight: 1000, clientHeight: 500, offsetParent: {}, getClientRects: () => [{}] };
}
// A visible [dir="auto"] text node inside `parent`.
function auto(text: string, parent: Node): Node {
  return { innerText: text, textContent: text, parentElement: parent, offsetParent: {}, getClientRects: () => [{}] };
}

describe("universalExtract — densest scroll region wins (thread over sidebar)", () => {
  it("returns the conversation thread, not the sidebar chrome", () => {
    const body = { __body: true, parentElement: null };
    const thread = region(body);
    const sidebar = region(body);
    const overflow = new Map<Node, string>([[thread, "auto"], [sidebar, "scroll"]]);

    const autos = [
      auto("Hey, are you still interested in the pro plan for your team?", thread),
      auto("Yeah — what does it cost per seat, and is there a trial?", thread),
      // sidebar chrome: short, separate scroll region
      auto("Chats", sidebar),
      auto("Search", sidebar),
      auto("Requests", sidebar),
    ];

    const extract = loadUniversalExtract({ autos, body, overflowByNode: overflow });
    const out = extract();
    expect(out).toContain("pro plan for your team");
    expect(out).toContain("what does it cost per seat");
    expect(out).not.toContain("Requests"); // the sidebar region lost — it's less dense
  });

  it("returns empty when the densest region is below the 40-char floor (thin page)", () => {
    const body = { __body: true, parentElement: null };
    const thread = region(body);
    const autos = [auto("hi", thread), auto("ok", thread)];
    const extract = loadUniversalExtract({ autos, body, overflowByNode: new Map([[thread, "auto"]]) });
    expect(extract()).toBe("");
  });

  it("skips hidden [dir=auto] nodes (offsetParent null + no client rects)", () => {
    const body = { __body: true, parentElement: null };
    const thread = region(body);
    const hidden = { ...auto("SHOULD NOT APPEAR hidden collapsed history block here", thread), offsetParent: null, getClientRects: () => [] };
    const autos = [
      auto("Visible message that is clearly long enough to pass the floor test.", thread),
      hidden,
    ];
    const extract = loadUniversalExtract({ autos, body, overflowByNode: new Map([[thread, "auto"]]) });
    const out = extract();
    expect(out).toContain("Visible message");
    expect(out).not.toContain("SHOULD NOT APPEAR");
  });
});

describe("universalExtract — C.A.R.E and Sales share the same LOGIC (this behavioral coverage covers both)", () => {
  const body = (src: string) => {
    const m = src.match(/globalThis\.universalExtract\s*=\s*function universalExtract\(\)\s*\{[\s\S]*?\n {2}\};/);
    return m ? m[0] : null;
  };
  // Compare LOGIC only — comments/formatting may differ between the two client files (they do), but the
  // executable logic must match so the sales behavioral test above provably covers C.A.R.E too. Detection-true:
  // a real logic change to one (a fix, a heuristic tweak) not mirrored to the other fails this.
  const logic = (s: string) => s.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
  it("both adapters.js define logic-identical universalExtract (comments may differ, logic must not)", () => {
    const sales = body(readFileSync(join(process.cwd(), "extension-sales", "adapters.js"), "utf-8"));
    const care = body(readFileSync(join(process.cwd(), "extension", "adapters.js"), "utf-8"));
    expect(sales).not.toBeNull();
    expect(care).not.toBeNull();
    expect(logic(care!)).toBe(logic(sales!)); // logic drift means the behavioral test no longer covers C.A.R.E
  });
});
