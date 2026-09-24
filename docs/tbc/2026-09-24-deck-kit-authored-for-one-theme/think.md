# THINK — the twelfth surface, and the producer behind eleven of them

started_at: 2026-09-24T08:40:00Z

## The task

Roleplay Practice, twelfth of the thirteen Sales Coach surfaces in the render pass the founder
chose ("Render every Sales Coach screen and look").

## Hypotheses formed BEFORE looking

Read from source, to be confirmed or killed by the render — never the other way round:

1. `bg-white/[0.06]` on the prospect's chat bubble (`roleplay/page.tsx:498`) is invisible on cream,
   so half the conversation loses its shape.
2. The composer input at `:541` carries `text-primary` inside `bg-brand-shell` — a container that
   is `#0B1620` in BOTH themes. On light that is near-black text on a near-black field.
3. `bg-black/20` on the unselected persona cards reads as "disabled" on a cream page.

## What made hypothesis 2 the interesting one

`bg-brand-shell` is not a theme-following surface. `CareShell.tsx:380` says so in words: the
sidebar "is intentionally dark-brand (bg-brand-shell) regardless". Inside it, `text-white/90` is
the correct choice and `border-white/[0.08]` is the correct choice.

So the composer's `bg-black/30` and `border-white/10` are RIGHT. The defect is one token: the text.
A fixed-dark island with theme-following text agrees with itself in exactly one mode.

This is the §2.2 shape at the CSS layer — two sources of truth for "what colour is the ground
here", one fixed and one derived, and nothing in the type system or the gate can notice they
disagree.

## What the render found that no hypothesis predicted

Every `<DeckCard>` on the review screen lost its border on cream, and the review screen has no
page-local `white/N` at all. The producer is `src/components/sales-coach/ui/deck.tsx` — the shared
kit — at five sites, plus four `-300` tone tints of the class fixed on Analytics this morning.

6 files import it; 22 `<DeckCard>`, 7 `<DeckGhostButton>`. **`strategy/page.tsx` — the one surface
still unrendered — has ZERO `white/N` of its own and inherits all of it.** A grep of that file
reports a clean page.

## The founder's call

Put to the picker, because changing a primitive 22 instances depend on, on the eve of an investor
demo, is a blast-radius decision and not mine. All 22 callers were read first: none overrides the
base border/bg, so no caller could conflict. Chosen: **"Fix the kit, verify every capture."**
