---
title: "Master Sales Mind — A Beginner's Guide to Building in Our System"
author: "For Moses"
---

<!--
  This Markdown file is the SOURCE OF TRUTH (audit F4). The committed
  PDF is generated from it. After editing this file, regenerate the PDF
  so they don't drift:
    npx --yes md-to-pdf docs/moses/Master-Sales-Mind-Builder-Guide.md
-->

# Master Sales Mind — A Beginner's Guide to Building in Our System

**Who this is for:** You, Moses. You're new to programming and new to
this project. That's completely fine. This guide takes you from "I've
never touched this" to "I can make a small, safe change and save it."
No prior knowledge assumed. Read it slowly. You don't have to finish it
in one sitting.

**One thing to be clear about up front:** you are a **co-founder and an
equal owner** of this system. Nothing here is hidden from you and you
have the same full access as the founder — the *only* reason this guide
goes slowly and plainly is that you're new to *building*, not because
anything is held back. The complete discipline lives in `Thinkx1.md`,
`Thinkx2.md`, and the full files they point to; it's all yours.

**The golden rule before anything else:** you are never alone in here.
You have a Coach built into the project. When you open the project and
type **"I'm Moses"**, the Coach is meant to greet you and help you with
every step. (If it doesn't respond, that's not your fault — ask the
founder to make sure the Coach is active.) Whenever this guide says
"ask the Coach," it means exactly that.

---

## Part 0 — What this project even is

Think of this project as a **website that the team uses to run their
work** — like a private app with a sidebar, pages, buttons, and data.
You're going to add a learning section to it called **Master Sales
Mind**.

It's built with a few standard tools. You don't need to understand them
deeply yet — just know their names:

- **The code** is written mostly in a language called **TypeScript**
  (it's JavaScript with extra safety checks).
- **The pages** are built with a tool called **Next.js**.
- **The data** (users, messages, files) lives in a database called
  **Supabase**.

That's it for now. You'll learn what these mean by *using* them, not by
memorizing them.

---

## Part 1 — The rule-books (read these first)

In the project folder there are two short files: **Thinkx1.md** and
**Thinkx2.md**.

- **Thinkx1.md** = *the rules.* How everyone here builds. Eight short
  rules. Read it.
- **Thinkx2.md** = *the lessons.* The real mistakes behind the rules.
  Read it.

They're written for you, in plain language. They are more important
than any code. **Read them before you write a single line.** If you
don't understand one, ask the Coach — that's what it's for.

> If either file is missing from the project folder, tell the founder.
> We don't start building without them. (Your Coach will check this for
> you automatically.)

---

## Part 2 — Setting up your computer (one time)

You need three things installed. Take them one at a time.

1. **A code editor** — install **VS Code** (free, from
   code.visualstudio.com). This is where you'll read and write code.
2. **Node.js** — install the "LTS" version from nodejs.org. This lets
   you run the project. After installing, you can check it worked by
   opening a terminal and typing `node --version` — if it prints a
   number, you're good.
3. **Git** — install from git-scm.com. This is how you save and share
   your work.

Don't worry about understanding these fully. They're just tools, like a
hammer and a saw. The Coach can help if any install gives you trouble.

---

## Part 3 — Getting the project onto your computer

Your founder will give you the project's address (a link) and access.
Then, in a terminal:

1. **Download the project** ("clone" it):
   `git clone <the-address-the-founder-gives-you>`
2. **Go into the project folder:**
   `cd <the-project-folder-name>`
3. **Install the project's parts** (this downloads everything the
   project needs — it can take a few minutes):
   `npm install`

If any step shows a scary-looking error, copy it and ask the Coach.
Errors are normal. They're information, not failure.

---

## Part 4 — Meet your Coach

Open the project folder in VS Code. Then open the Claude Code assistant
(your founder will show you how to start it in the project).

Type exactly: **I'm Moses**

The Coach should greet you and check that Thinkx1.md and Thinkx2.md are
present. (If it doesn't greet you, ask the founder to confirm the Coach
is set up — the trigger is new and may need turning on.) From that
point on, the Coach is your guide. Ask it anything:
"what does this word mean?", "what's the next step?", "is this safe to
change?". It will **teach** you and **guide** you — it won't just do the
work for you, because the point is for *you* to learn to build.

---

## Part 5 — Running the project (seeing it live)

In the terminal, inside the project folder, type:

`npm run dev`

After a moment it will show a web address (usually
`http://localhost:3000`). Open that in your browser. You're now looking
at the actual app, running on your own computer. Changes you make to
the code will show up here.

To stop it later, click the terminal and press `Ctrl + C`.

---

## Part 6 — How the project is organized (the simple version)

You don't need the whole map. Here's the part that matters for you:

- **`src/app/dashboard/`** — this is where the app's **pages** live.
  Each page is a folder with a file called `page.tsx`.
- Your section already exists here:
  **`src/app/dashboard/bootcamp/master-sales-mind/page.tsx`**
  — that's the **Master Sales Mind** page. In the running app you'll
  find it in the sidebar under **Production → Bootcamp → Master Sales
  Mind**.

Open that file in VS Code and read it with the Coach. It already shows
a "materials coming" message. Your job, over time, is to fill it with
real training content — in small, safe, tested steps.

---

## Part 7 — The building loop (do this every single time)

This is the rhythm of all the work. Memorize this loop, not the code:

1. **Understand.** Know *why* you're making the change and *what* it's
   for. If you can't say it out loud, ask the Coach first. (Thinkx1,
   Rule 1.)
2. **Make ONE small change.** The smallest thing that moves you forward.
   Not ten things — one.
3. **Run it and look.** Save the file, look at `localhost:3000` in your
   browser. Did it do what you expected? (Thinkx2, Lesson 1: "saved" is
   not "they can see it" — *look at the screen*.)
4. **If it broke, don't pile on patches.** If the same thing fails
   twice, stop and re-understand. (Thinkx1, Rule 7.)
5. **Save it.** Once it works and you've *seen* it work, save your work
   (next part).

Small loop, many times. That's how real software gets built — not in
one giant leap.

---

## Part 8 — Saving your work (Git, the gentle version)

When a small piece works and you've tested it:

1. **Start a safe workspace** (a "branch") so you never disturb the
   main project:
   `git checkout -b moses/my-first-change`
2. **Stage your changes** (tell Git what to save):
   `git add -A`
3. **Save them with a note** (a "commit"):
   `git commit -m "Add a heading to the Master Sales Mind page"`
   — the note should say *what* you did, plainly.
4. **Share it** (push) when your founder asks:
   `git push origin moses/my-first-change`

The Coach will walk you through this the first few times. Small, clear
saves are the goal. (Thinkx1, Rule 6.)

---

## Part 9 — When you get stuck (and you will — everyone does)

1. **Re-read the relevant lesson** in Thinkx2.md. Your situation is
   probably in there.
2. **Ask the Coach.** Describe what you did, what you expected, and what
   actually happened. The more honest and specific you are, the better
   it can help.
3. **Don't loop.** If you've tried the same fix twice and it failed
   twice, stop — your *understanding* is off, not your typing. Go back
   to "Understand" with the Coach. (Thinkx1, Rule 7.)
4. **Be honest about what you haven't tested.** Saying "I'm not sure
   this works yet" is a strength here, not a weakness. (Thinkx1, Rule 8.)

---

## Part 10 — Your first tiny practice task

Don't build the whole feature yet. Just prove the loop works:

1. Type **"I'm Moses"** to the Coach and read the two rule-books with it.
2. Open `src/app/dashboard/bootcamp/master-sales-mind/page.tsx`.
3. With the Coach, change one piece of visible text on the page (for
   example, a heading) to something small and harmless.
4. Run the project, open the page in your browser, and **see** your
   change.
5. Save it on a branch with a clear commit note.

If you can do those five steps, you can build. Everything else is just
more of the same loop, with the Coach beside you.

---

**Welcome aboard, Moses.** Go slow, ask everything, and trust the loop.
The Coach has your back.
