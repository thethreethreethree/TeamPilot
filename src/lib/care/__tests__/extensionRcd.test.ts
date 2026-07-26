import { describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * RCD (Raw Conversation Data) capture helpers — logic verification.
 *
 * SCOPE (honest, per AMD-006 3rd addendum + ThinkerThinker.md A38): this verifies the PURE PARSING
 * LOGIC of the extension's RCD helpers (`rcdFrom`, `defaultMediaFrom`, `rcdOrText`) against a controlled
 * fake DOM — that per-message attribution is preserved (A39), that media references are captured and UI
 * icons filtered, that assets de-dupe, and that capture degrades to a text floor when a selector misses.
 *
 * It does NOT — and cannot, in this node-only harness with no live browser — verify the third-party CSS
 * selectors (WhatsApp/Gmail/Zendesk/… DOM). Those remain RUNTIME-UNVERIFIED exactly as the adapter file's
 * own header states. A fake DOM is used deliberately: the project's vitest env is `node` (no jsdom/happy-dom
 * installed), and adding a DOM dependency was out of scope for this build. What's tested is the logic that
 * is mine to get right; the live-selector correctness is explicitly out of scope and flagged as such.
 */

type Attrs = Record<string, string>;
type RcdMessage = { role: string; sender: string; text: string; media: Array<Record<string, string>> };
type Helpers = {
  rcdFrom: (msgSel: string, roleOf: ((n: unknown) => string) | null) => RcdMessage[];
  defaultMediaFrom: (node: unknown) => Array<Record<string, string>>;
  rcdOrText: (msgSel: string, roleOf: ((n: unknown) => string) | null, fallback: () => string) => RcdMessage[];
};

function fakeChild(tag: string, attrs: Attrs) {
  const num = (k: string) => (attrs[k] ? parseInt(attrs[k], 10) : 0);
  return {
    tagName: tag.toUpperCase(),
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    currentSrc: attrs.src ?? "",
    src: attrs.src ?? "",
    href: attrs.href ?? "",
    naturalWidth: num("width"),
    naturalHeight: num("height"),
    width: num("width"),
    height: num("height"),
    textContent: attrs._text ?? "",
    // Video elements resolve their src via a nested <source> when there's no direct src attr.
    querySelector: (sel: string) => (sel === "source" && attrs._sourceSrc ? { src: attrs._sourceSrc } : null),
  };
}

function fakeMsg(opts: {
  text?: string;
  cls?: string[];
  imgs?: Attrs[];
  links?: Attrs[];
  media?: Array<{ tag: "video" | "audio"; attrs: Attrs }>;
}) {
  const children: Record<string, unknown[]> = {
    img: (opts.imgs ?? []).map((a) => fakeChild("img", a)),
    "a[href]": (opts.links ?? []).map((a) => fakeChild("a", a)),
    "video, audio": (opts.media ?? []).map((m) => fakeChild(m.tag, m.attrs)),
  };
  return {
    offsetParent: {}, // truthy → passes the visibility guard
    getClientRects: () => ({ length: 1 }),
    innerText: opts.text ?? "",
    textContent: opts.text ?? "",
    classList: { contains: (c: string) => (opts.cls ?? []).includes(c) },
    querySelectorAll: (sel: string) => children[sel] ?? [],
  };
}

// Controlled document: rcdFrom calls document.querySelectorAll(msgSel); we return a fixture keyed by
// selector (an unmapped selector → [] models a real-world "selector missed nothing").
let DOC: Record<string, unknown[]> = {};
let H: Helpers;

beforeAll(async () => {
  // Loading the plain-script adapter file publishes the helpers onto globalThis (its own pattern).
  // @ts-expect-error — plain browser script (no ES exports); imported for its globalThis side-effects.
  await import(/* @vite-ignore */ "../../../../extension/adapters.js");
  H = globalThis as unknown as Helpers;
});

beforeEach(() => {
  DOC = {};
  (globalThis as unknown as { document: unknown }).document = {
    querySelectorAll: (sel: string) => DOC[sel] ?? [],
  };
});

describe("defaultMediaFrom", () => {
  it("captures images (url + alt) and attachment links (url + filename)", () => {
    const node = fakeMsg({
      imgs: [{ src: "https://cdn.example.com/photo.jpg", alt: "a receipt", width: "600", height: "400" }],
      links: [{ href: "https://files.example.com/invoice.pdf", download: "invoice.pdf", _text: "Download" }],
    });
    const media = H.defaultMediaFrom(node);
    expect(media).toContainEqual({ type: "image", url: "https://cdn.example.com/photo.jpg", alt: "a receipt" });
    expect(media).toContainEqual({ type: "file", url: "https://files.example.com/invoice.pdf", filename: "invoice.pdf" });
  });

  it("filters out tiny UI icons / emoji-sized images", () => {
    const node = fakeMsg({
      imgs: [
        { src: "https://x/icon.png", width: "16", height: "16" },
        { src: "https://x/real.png", width: "300", height: "200" },
      ],
    });
    const urls = H.defaultMediaFrom(node).map((m) => m.url);
    expect(urls).toContain("https://x/real.png");
    expect(urls).not.toContain("https://x/icon.png");
  });

  it("captures a link by file-extension even without a download attr", () => {
    const node = fakeMsg({ links: [{ href: "https://x/report.xlsx?token=1", _text: "report" }] });
    expect(H.defaultMediaFrom(node)).toContainEqual({
      type: "file",
      url: "https://x/report.xlsx?token=1",
      filename: "report",
    });
  });

  it("ignores non-file links and never throws on an empty node", () => {
    const node = fakeMsg({ links: [{ href: "https://x/profile", _text: "see profile" }] });
    expect(H.defaultMediaFrom(node)).toEqual([]);
    expect(H.defaultMediaFrom(fakeMsg({}))).toEqual([]);
  });

  it("captures video (direct src or nested <source>) and audio", () => {
    const node = fakeMsg({
      media: [
        { tag: "video", attrs: { src: "https://x/clip.mp4" } },
        { tag: "video", attrs: { _sourceSrc: "https://x/via-source.webm" } }, // src resolved via <source>
        { tag: "audio", attrs: { src: "https://x/voice.mp3" } },
      ],
    });
    const media = H.defaultMediaFrom(node);
    expect(media).toContainEqual({ type: "video", url: "https://x/clip.mp4" });
    expect(media).toContainEqual({ type: "video", url: "https://x/via-source.webm" });
    expect(media).toContainEqual({ type: "audio", url: "https://x/voice.mp3" });
  });
});

describe("rcdFrom — per-message structure + attribution (A39)", () => {
  it("preserves role per message, skips empty messages, captures media with its message", () => {
    DOC[".msg"] = [
      fakeMsg({ text: "hello there", cls: ["out"] }),
      fakeMsg({
        text: "where is my order?",
        cls: ["in"],
        imgs: [{ src: "https://x/screenshot.png", alt: "order screen", width: "400", height: "300" }],
      }),
      fakeMsg({ text: "", cls: ["out"] }), // empty → skipped
    ];
    const rcd = H.rcdFrom(".msg", (n) => ((n as { classList: { contains: (c: string) => boolean } }).classList.contains("out") ? "agent" : "customer"));
    expect(rcd).toHaveLength(2);
    expect(rcd[0]).toMatchObject({ role: "agent", text: "hello there", media: [] });
    expect(rcd[1]).toMatchObject({ role: "customer", text: "where is my order?" });
    expect(rcd[1]!.media).toContainEqual({ type: "image", url: "https://x/screenshot.png", alt: "order screen" });
  });

  it("treats a sender NAME (not agent/customer) as sender, role stays unknown", () => {
    DOC[".m"] = [fakeMsg({ text: "hi" })];
    const rcd = H.rcdFrom(".m", () => "Alice Customer");
    expect(rcd[0]).toMatchObject({ role: "unknown", sender: "Alice Customer" });
  });

  it("keeps a media-only message even with no text", () => {
    DOC[".m"] = [fakeMsg({ text: "", imgs: [{ src: "https://x/pic.png", width: "500", height: "500" }] })];
    const rcd = H.rcdFrom(".m", null);
    expect(rcd).toHaveLength(1);
    expect(rcd[0]!.media[0]!.url).toBe("https://x/pic.png");
  });

  it("returns [] (never throws) when the selector matches nothing", () => {
    expect(H.rcdFrom(".does-not-exist", null)).toEqual([]);
  });
});

describe("rcdOrText — guaranteed text floor (§3.4 degrade, never worse than today)", () => {
  it("degrades to a single synthetic message from the text fallback when the container selector misses", () => {
    expect(H.rcdOrText(".nope", null, () => "raw scraped text")).toEqual([
      { role: "unknown", sender: "", text: "raw scraped text", media: [] },
    ]);
  });

  it("prefers the structured capture when the selector hits", () => {
    DOC[".m"] = [fakeMsg({ text: "structured" })];
    const rcd = H.rcdOrText(".m", null, () => "should not be used");
    expect(rcd).toHaveLength(1);
    expect(rcd[0]!.text).toBe("structured");
  });

  it("returns [] when both the selector and the text fallback are empty", () => {
    expect(H.rcdOrText(".nope", null, () => "")).toEqual([]);
  });
});
