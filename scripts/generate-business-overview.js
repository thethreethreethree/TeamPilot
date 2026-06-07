/**
 * Generate a Word document explaining ELOSTATE for a non-technical business partner.
 * Run:  node scripts/generate-business-overview.js
 * Outputs to docs/ELOSTATE-Business-Overview.docx
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── style helpers ──────────────────────────────────────────────

const C_PRIMARY = "1a3aff";
const C_TEXT = "2a2f4a";
const C_MUTED = "6a7090";
const C_ACCENT = "5470ff";

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 36,
        color: C_PRIMARY,
        font: "Calibri",
      }),
    ],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: C_TEXT,
        font: "Calibri",
      }),
    ],
  });

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: 80, after: 160, line: 320 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        size: 22,
        color: opts.muted ? C_MUTED : C_TEXT,
        italics: opts.italic ?? false,
        bold: opts.bold ?? false,
        font: "Calibri",
      }),
    ],
  });

const pmix = (...runs) =>
  new Paragraph({
    spacing: { before: 80, after: 160, line: 320 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          italics: r.italic ?? false,
          size: 22,
          color: r.color ?? C_TEXT,
          font: "Calibri",
        })
    ),
  });

const bullet = (text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 300 },
    children: [
      new TextRun({ text, size: 22, color: C_TEXT, font: "Calibri" }),
    ],
  });

const bulletBold = (label, text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 300 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, color: C_TEXT, font: "Calibri" }),
      new TextRun({ text: " — " + text, size: 22, color: C_TEXT, font: "Calibri" }),
    ],
  });

const callout = (text) =>
  new Paragraph({
    spacing: { before: 160, after: 240, line: 320 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        size: 22,
        color: C_ACCENT,
        italics: true,
        font: "Calibri",
      }),
    ],
  });

const spacer = () =>
  new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun("")] });

const pageBreak = () =>
  new Paragraph({ children: [new PageBreak()] });

// ─── content ────────────────────────────────────────────────────

const children = [];

// COVER
children.push(
  new Paragraph({
    spacing: { before: 800, after: 240 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "ELOSTATE",
        bold: true,
        size: 96,
        color: C_PRIMARY,
        font: "Calibri",
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 0, after: 720 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "An honest AI executive operating system",
        size: 28,
        color: C_TEXT,
        font: "Calibri",
        italics: true,
      }),
    ],
  }),
  p(
    "A business overview written for a non-technical partner. The goal of this document is to explain — clearly, in plain language, with enough detail to make a confident decision — what this software is, what it solves, how it operates, and why it works.",
    { muted: true, italic: true, center: true }
  ),
  spacer(),
  p("Prepared for: Business partner", { muted: true, center: true }),
  p("Date: " + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), { muted: true, center: true }),
  pageBreak()
);

// ─── 1. WHAT IT IS ──────────────────────────────────────────────
children.push(
  h1("1. What it is"),
  p(
    "ELOSTATE is software that runs alongside the leadership of a company and helps them make better decisions. We describe it as an \"executive operating system\" — the same way Windows or macOS is an operating system for your computer, ELOSTATE is an operating system for how an executive runs the business."
  ),
  p(
    "It is a web application. There is nothing to install. The user signs in through a browser, sets up their company, and starts using it like they would any other modern business tool (think: Notion, Slack, or Salesforce, but specifically for executive decision-making)."
  ),
  p(
    "It is also an AI product. There is artificial intelligence powering many of the features. But — and this is the critical word — the AI is restrained, not assertive. It refuses to give you answers it has not earned. That distinction is the entire value proposition. We'll come back to it."
  ),
  h2("The short version"),
  p(
    "If you had to explain ELOSTATE in one sentence, it is this: a system that helps executives diagnose problems honestly, decide carefully, and learn measurably from what actually worked."
  ),
  callout(
    "It is not another dashboard. It is not another AI chatbot. It is a discipline, encoded as software."
  ),
  h2("What it looks like to use"),
  p(
    "An executive opens their browser, goes to their ELOSTATE account, and sees a Command Center — like the dashboard of a car. It shows them the current state of their business: how many open tasks exist, what's blocked, what problems are emerging, what decisions have recently been made, and whether those decisions actually held up over time."
  ),
  p(
    "From there, they can drill into any of these areas. They can walk through a structured diagnostic process for a problem they're facing. They can paste in a meeting transcript and get help turning it into action items. They can review past decisions and tell the system whether they actually worked. Every interaction either feeds the system more information or surfaces what the system has learned."
  ),
  pageBreak()
);

// ─── 2. WHAT IT SOLVES ──────────────────────────────────────────
children.push(
  h1("2. What it solves"),
  p(
    "To understand what ELOSTATE solves, you have to understand a specific problem that almost every growing company suffers from, often without recognizing it."
  ),
  h2("The problem: confident-but-wrong intelligence"),
  p(
    "Modern executives are drowning in tools that produce confident-sounding insights. Dashboards say \"churn is up 4%.\" AI assistants say \"you should consider firing John.\" Consultants deliver 40-slide decks with bold recommendations. Reports flag \"critical risks.\""
  ),
  p(
    "The trouble: most of these confident statements are not actually earned. The dashboard doesn't know whether 4% is meaningful or noise. The AI doesn't actually know whether John should be fired. The consultant's slide says \"reduce headcount\" because they were paid to find something to recommend. The result is that executives spend their days sorting through plausible-sounding but unreliable signals — and slowly lose trust in their own ability to read the business."
  ),
  p(
    "We call this \"knowledge imitating intelligence.\" The output looks intelligent. It uses confident language. It has the right structure. But the reasoning behind it was never earned. The system speaking does not actually understand the situation it is describing. It is just producing fluent-looking output."
  ),
  h2("Why this is getting worse, not better"),
  p(
    "The arrival of generative AI (ChatGPT, etc.) has made the problem much worse, not better. AI tools can now generate paragraph after paragraph of plausible business analysis in seconds. They sound competent. They use industry vocabulary. But there is no actual diagnostic discipline behind the words — just statistical pattern matching on training data."
  ),
  p(
    "Executives who rely on these tools are increasingly making decisions based on output that sounds smart but isn't. The cost is wrong calls, wasted resources, and gradually losing touch with what's actually going on in the business."
  ),
  h2("Specific examples"),
  bulletBold(
    "Dashboards that lie by omission.",
    "A revenue dashboard shows \"MRR is healthy\" but doesn't surface that 60% of the growth comes from one customer about to churn."
  ),
  bulletBold(
    "AI summaries that flatten nuance.",
    "An AI meeting-notes tool turns a 45-minute strategic debate into three action items that miss the actual disagreement."
  ),
  bulletBold(
    "\"Recommendation engines\" that fabricate confidence.",
    "An AI tool tells the CEO \"reduce engineering headcount by 15%\" with no real basis — just because the prompt asked for a recommendation."
  ),
  bulletBold(
    "Reports that surface symptoms, not causes.",
    "A weekly ops report says \"3 tasks are blocked\" but the underlying pattern is one team's approval process being broken across 50 tasks over six months."
  ),
  h2("The cost"),
  p(
    "When executives lose trust in their tools, they fall back on intuition and politics. Decisions become slower, more conservative, and harder to defend. Critical issues get missed because they were buried under fake-confident chatter. And the team starts making smaller bets and avoiding the hard calls."
  ),
  h2("What ELOSTATE fixes"),
  p(
    "ELOSTATE is built on the opposite principle. It refuses to speak unless it has earned the right to. It demands evidence before surfacing a problem. It asks the user what they think first, then offers its own perspective — never overriding the human's judgment. And it measures whether decisions actually worked, rather than just whether they were made."
  ),
  callout(
    "The product the world doesn't have yet: an AI that is honest about what it doesn't know."
  ),
  pageBreak()
);

// ─── 3. HOW IT OPERATES ─────────────────────────────────────────
children.push(
  h1("3. How it operates"),
  p(
    "ELOSTATE operates through a specific loop, repeated continuously, that mirrors how a good diagnostic doctor or senior detective actually works. We call it the \"living diagnosis\" loop because the system is constantly cycling through it as new information arrives."
  ),
  h2("The five-step loop"),
  bulletBold(
    "Step 1 — Capture everything as evidence.",
    "Every action in the business — a task created, a status changed, a comment posted, an invoice issued — is recorded as a permanent event. Nothing gets deleted. The record is the source of truth."
  ),
  bulletBold(
    "Step 2 — Detect patterns across the record.",
    "From the events, the system derives signals (things worth noticing). When signals repeat, they accumulate into patterns. A single late task is not a signal. Three late tasks from the same team across two weeks is a pattern."
  ),
  bulletBold(
    "Step 3 — Surface problems only when earned.",
    "When patterns accumulate to a certain threshold (at least three signals from at least two distinct sources), the system surfaces a candidate problem. Below that threshold, the system stays silent. This rule is enforced at the database level — the software literally cannot bypass it."
  ),
  bulletBold(
    "Step 4 — Walk to a resolution with the human in charge.",
    "When a problem is surfaced, the executive walks through a structured dialogue. The system asks the executive's read first. Then it adds its own perspective. Then it offers a suggestion with explicit reasoning. Then it traces the ripple effects across the rest of the business. The executive decides — never the AI."
  ),
  bulletBold(
    "Step 5 — Measure consequence, not agreement.",
    "After enough time passes, the executive reviews each resolution and records whether it actually held, partially held, or reopened. This is the only data that counts toward making the system smarter — because acceptance is not the same as success."
  ),
  h2("The seven surfaces (what's in the product)"),
  p(
    "These five steps are exposed to the user through seven main screens — each one a window into a different part of the loop."
  ),
  bulletBold(
    "Command Center.",
    "The home screen. Real-time view of the current state — open tasks, signals being detected, problems in progress, resolutions waiting for review, and the \"held rate\" (what percent of past decisions actually held over time)."
  ),
  bulletBold(
    "Tasks.",
    "The work-management view. Create, edit, delete tasks. Every change becomes an event that feeds the loop."
  ),
  bulletBold(
    "Living Diagnosis.",
    "The seven-stage diagnostic walk for any problem. Helps the executive examine the evidence, consider outside perspectives, evaluate the strength of their understanding, predict ripple effects, decide, and close the loop."
  ),
  bulletBold(
    "Problems.",
    "The hypothesis manager. Where executives write down what they think might be going wrong, link the supporting signals, and check whether the evidence is strong enough to act on."
  ),
  bulletBold(
    "Resolutions.",
    "The outcome review. Where past decisions get marked as held, partial, reopened, or unknown — the only data that counts as real learning."
  ),
  bulletBold(
    "Decision Dialogue.",
    "For any decision the executive faces, this walks through a four-phase structured conversation. The executive states their read; the system offers perspective; both views are compared; the executive decides. The reasoning is preserved."
  ),
  bulletBold(
    "Conversation Dialogue.",
    "Paste a meeting transcript, write what you think was decided, and the system refines your read — preserving disagreement and ambiguity rather than flattening it into false-confident summaries."
  ),
  bulletBold(
    "Company Brain.",
    "A view into what the AI has learned about this specific company — phrased plainly, with full audit trail of what was learned, when, and from which decisions. Nothing the AI learns happens invisibly."
  ),
  h2("Per-company memory (this is what makes it valuable over time)"),
  p(
    "Most AI products treat every customer the same. Same prompts, same suggestions, same vocabulary. They might be tuned generally, but they don't actually know any particular company."
  ),
  p(
    "ELOSTATE is different. Each company that uses ELOSTATE gets its own AI memory that learns from that company's actual outcomes. Over months of use, the system learns the company's vocabulary, the patterns that show up there, the diagnostic methods that have actually produced lasting decisions, and the kinds of suggestions that have been rejected (and why)."
  ),
  p(
    "Most AI products plateau the moment they ship. ELOSTATE sharpens every month it runs against your work — until it isn't giving you generic exec advice anymore, but advice from a system that has watched how your team actually makes decisions. That accumulating clarity is the product, and it belongs to you. Your data, your account, exportable on demand."
  ),
  h2("The honesty protocol (Month 1 = silent)"),
  p(
    "Critically: in the first 30 days of any new company's use of ELOSTATE, the AI is silent. It does not offer suggestions or judgments. It only records and learns. This is intentional. It captures a clean baseline of how the team operates without AI guidance. Then, starting in Month 2, the AI begins offering refined input."
  ),
  p(
    "This means we can show every customer — with their own data — exactly what changed when the AI was turned on. It is also a statement of values: we refuse to fake intelligence in the first 30 days when we don't actually have any data to be intelligent about."
  ),
  pageBreak()
);

// ─── 4. WHY IT WORKS ────────────────────────────────────────────
children.push(
  h1("4. Why it works"),
  p(
    "There are four reasons ELOSTATE works — meaning, four reasons it produces better outcomes for customers than the alternatives, and four reasons it is defensible as a business."
  ),
  h2("Reason 1 — Honesty becomes the moat"),
  p(
    "Every AI product on the market today is racing to look smarter, more confident, more capable. ELOSTATE is racing in the opposite direction: to be more honest about what it doesn't know."
  ),
  p(
    "This sounds counterintuitive until you spend time with the actual customers. Executives are tired of confident-but-wrong AI. They want a tool that will admit when it doesn't have enough information. They want their team's judgment to be sharpened, not replaced. They want decisions they can defend in front of a board."
  ),
  p(
    "ELOSTATE is the product the market doesn't realize it's about to demand — and once it does, competitors built around \"more confident AI\" will be structurally unable to pivot. Their entire training, prompting, and value proposition is built on the wrong axis."
  ),
  h2("Reason 2 — The data flywheel"),
  p(
    "Every decision made through ELOSTATE is recorded. Every outcome reviewed. Every method validated or rejected. Over months and years, the per-company memory becomes irreplaceable: it is a structured history of how this specific team actually makes decisions and which ones actually worked."
  ),
  p(
    "This is true switching cost. A customer cannot easily move to a competitor and rebuild that memory — they would lose years of accumulated learning. And the more decisions they run through ELOSTATE, the better the system gets at advising them specifically. The product gets more valuable to the customer over time. They get more locked in. We get more predictable revenue."
  ),
  h2("Reason 3 — Measurement, not agreement"),
  p(
    "Almost every other AI product measures success by user engagement — did the user accept the suggestion, did they use the feature, did they come back tomorrow. These metrics are easy to game and ultimately measure agreement, not value."
  ),
  p(
    "ELOSTATE measures success by whether resolutions held — meaning, did the decision actually produce the predicted outcome, or did the problem reopen? This is what every customer's CFO actually wants to know. It is also what makes the system improve over time: only validated outcomes feed the AI's learning. Garbage acceptance does not become garbage suggestions next time."
  ),
  callout(
    "Every other AI grades its own homework. ELOSTATE grades by consequence."
  ),
  h2("Reason 4 — Built on a discipline that is hard to copy"),
  p(
    "Anyone can build an AI dashboard. Almost no one can build the diagnostic discipline that ELOSTATE encodes — because the discipline is not a feature, it is a constitution. The entire system is built so that the rules are enforced structurally (in the database, in the API, in the UI flows) rather than as a checkbox somewhere."
  ),
  p(
    "When a competitor decides to add \"discipline\" as a feature, they will discover that the discipline must be present in every interaction, every prompt, every screen, every database schema. It is not a feature to add at the end. It is the architecture itself. And building that requires accepting the trade-off of being slower and quieter than competitors — something most VC-funded AI startups cannot stomach."
  ),
  h2("Where the bet pays off"),
  p(
    "If we are right that the next phase of AI demand is for restraint and honesty (not capability and confidence), ELOSTATE is positioned to be the category-defining product in executive decision-making. Customers will pay because the cost of wrong decisions is enormous and the existing tools are making it worse, not better. Switching cost will compound. Word of mouth among executives is strong because the product produces a noticeably different outcome — clearer thinking, defensible decisions, durable improvements."
  ),
  p(
    "And, critically, the product gets stronger as the AI ecosystem gets more capable. As the underlying language models (DeepSeek, GPT, Claude, etc.) improve, ELOSTATE gets even sharper at running its discipline on top of them. We are not in a race against the AI labs — we are running on top of them, channeling their capability through a structure that makes it useful."
  ),
  pageBreak()
);

// ─── HOW TO TALK ABOUT IT ───────────────────────────────────────
children.push(
  h1("5. How to talk about ELOSTATE"),
  p(
    "When explaining ELOSTATE to someone for the first time, here are some sentences that have worked well:"
  ),
  callout(
    "\"It's an AI executive operating system. The simplest way to describe it: it's an AI that refuses to give you an answer it hasn't earned.\""
  ),
  callout(
    "\"Most AI tools today produce confident-sounding output regardless of whether they actually understand the situation. ELOSTATE is built on the opposite principle — it stays silent until it has real evidence, and even then, the human is always in charge of the decision.\""
  ),
  callout(
    "\"It learns about each company specifically. After a few months, the AI knows your vocabulary, the patterns that come up on your team, and the kinds of decisions that actually work for you — not generic advice.\""
  ),
  h2("What ELOSTATE is NOT"),
  bulletBold("Not a chatbot.", "It is not ChatGPT for executives."),
  bulletBold(
    "Not a dashboard tool.",
    "It does not visualize KPIs. It surfaces problems and walks decisions."
  ),
  bulletBold(
    "Not a project management app.",
    "It does not replace Asana or Linear. It connects with them (eventually) but its purpose is decision quality, not task tracking."
  ),
  bulletBold(
    "Not an AI replacement for executives.",
    "It does not make decisions. It sharpens the executive's thinking and preserves the reasoning behind their decisions."
  ),
  h2("Common questions"),
  pmix(
    { text: "Q. ", bold: true },
    { text: "How is this different from ChatGPT for business?" }
  ),
  p(
    "A. ChatGPT will give you a confident answer to any question, regardless of whether it has the information to answer it. ELOSTATE will not. ELOSTATE demands evidence before surfacing problems, asks the user for their read before offering its own, and records every learning with full audit trail. Two completely different design philosophies."
  ),
  pmix(
    { text: "Q. ", bold: true },
    { text: "How much does it cost?" }
  ),
  p(
    "A. Pricing TBD as we acquire design partners. Expected SaaS subscription model with tiered pricing based on company size, retention of events, and integrations enabled. Likely $200 to $2,000 per month range."
  ),
  pmix(
    { text: "Q. ", bold: true },
    { text: "Who is the buyer?" }
  ),
  p(
    "A. The executive themselves — CEO, COO, founder, department head — at companies between 50 and 500 people. The pain is most acute at this stage: too big to keep everything in the CEO's head, too small to afford a real analyst team. Above 500 people, the buyer becomes the COO; below 50, the founder."
  ),
  pmix(
    { text: "Q. ", bold: true },
    { text: "What's the moat as competitors copy us?" }
  ),
  p(
    "A. Three things: (1) the per-company memory, which compounds value over time and creates real switching cost; (2) the constitutional discipline, which is structurally hard to copy because it has to be present everywhere in the architecture, not added as a feature; (3) the brand of being the honest AI in a market full of confident liars — once established, very hard to dislodge."
  ),
  pmix(
    { text: "Q. ", bold: true },
    { text: "Why now?" }
  ),
  p(
    "A. Two reasons. First, AI tools have proliferated to the point that executives are actively losing trust in them — there is real market demand for an AI that is honest about what it doesn't know. Second, the underlying language models (DeepSeek, GPT-4, Claude, etc.) are now capable enough that we can layer discipline on top of them and produce genuinely valuable outcomes, not just polished demos."
  ),
  pmix(
    { text: "Q. ", bold: true },
    { text: "Is it ready to sell?" }
  ),
  p(
    "A. The core architecture is built. All key features work. What we need now is design partners — a small number of paying customers who will help us validate that the learning cycle actually produces better outcomes than no-AI baselines, and refine the surfaces based on real use. From there, broader launch."
  ),
  spacer(),
  spacer(),
  p(
    "— End of overview —",
    { center: true, muted: true, italic: true }
  )
);

// ─── build doc ──────────────────────────────────────────────────

const doc = new Document({
  creator: "ELOSTATE",
  title: "ELOSTATE — Business Overview",
  description: "A non-technical overview of the ELOSTATE product for partners and stakeholders.",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 },
      },
    },
  },
  sections: [
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    },
  ],
});

const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const primaryPath = path.join(outDir, "ELOSTATE-Business-Overview.docx");

Packer.toBuffer(doc).then((buf) => {
  // If the primary file is locked (Word has it open), write a versioned copy
  // alongside it so the user gets the update without having to close Word.
  let outPath = primaryPath;
  try {
    fs.writeFileSync(primaryPath, buf);
  } catch (err) {
    if (err && err.code === "EBUSY") {
      const stamp = String(Math.floor(Date.now() / 1000));
      outPath = path.join(outDir, `ELOSTATE-Business-Overview.${stamp}.docx`);
      fs.writeFileSync(outPath, buf);
      console.log(
        "Primary path was locked (Word open?). Wrote to versioned copy instead."
      );
    } else {
      throw err;
    }
  }
  console.log("Wrote " + outPath + " (" + buf.length + " bytes)");
});
