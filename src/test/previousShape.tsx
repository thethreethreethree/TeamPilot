import type { ReactElement } from "react";
import { render, cleanup } from "@testing-library/react";

/**
 * Mount a surface against the response shape it was NOT compiled for.
 *
 * WHY THIS EXISTS, and it is not a lesson about carefulness. Three surfaces crashed on the same
 * thing in one session (2026-09-22):
 *
 *   · `PatternRow.events`      → `undefined.filter` through useMemo, whole tab down
 *   · `PatternRow.comparison`  → `undefined.thenMisses`, whole table down
 *   · `reviewFlags`            → `undefined.length`, six board tests red
 *
 * I wrote the defence for the first two and then shipped the third without it. That is the tell
 * that the correction is not "remember harder": at the moment of writing, the field always
 * exists, because the route that returns it was edited seconds earlier. The case where it does
 * not is a **browser holding its JS bundle across a deploy** — a client compiled against today's
 * response being handed yesterday's — and that state is invisible from inside the edit.
 *
 * Typecheck cannot see it: the type says the field is there, and over the wire a type is a
 * promise rather than a fact. Lint cannot see it. None of the ten audits can — `writer:audit`
 * asks whether a table has a writer, `enum:audit` whether a declared mirror is complete, and this
 * is neither.
 *
 * So the check is a test that deliberately removes a field and asserts the surface still renders
 * something. It converts "handle the undefined case" from a thing to remember into a thing a
 * suite proves.
 *
 * WHAT IT DOES NOT DO. It cannot tell you WHICH fields are new — that is the author's knowledge,
 * passed in. A helper that guessed would either miss the field that matters or assert against
 * every optional property in the wire, and A30 is explicit that an imprecise gate is worse than
 * none.
 */

export type PreviousShapeCase = {
  /** The field the current route added. Dotted paths are not supported: top-level only. */
  field: string;
  /** Rendered with that key deleted from the wire. */
  render: () => ReactElement;
};

/**
 * Drop one key from a wire object, the way an older route's response would lack it.
 *
 * Returns a NEW object; the caller's fixture is untouched, because a helper that mutated a shared
 * fixture would make the next test in the file fail for a reason that has nothing to do with it.
 */
export function withoutField<T extends object>(wire: T, field: string): T {
  const copy: Record<string, unknown> = { ...(wire as Record<string, unknown>) };
  delete copy[field];
  return copy as T;
}

/**
 * Assert a component renders without throwing when a field is missing.
 *
 * "RENDERS SOMETHING" IS THE BAR, not "renders correctly". A surface handed an older response
 * legitimately cannot show what it does not have — the point is that it says so, or omits that
 * part, rather than taking the page down. What it must never do is throw, because a thrown render
 * in React takes the whole tree with it, and the field in question is usually a small card on a
 * large board.
 */
export async function survivesWithout(
  cases: readonly PreviousShapeCase[]
): Promise<Array<{ field: string; threw: string | null }>> {
  const out: Array<{ field: string; threw: string | null }> = [];

  for (const c of cases) {
    // React logs a thrown render to console.error before rethrowing; silence it so a passing run
    // is readable, and restore immediately so an unrelated warning is not swallowed.
    const original = console.error;
    console.error = () => {};
    try {
      const { container } = render(c.render());
      // An empty container is acceptable — a card that cannot render itself and renders nothing is
      // the correct degradation. A THROWN render is not.
      void container;
      out.push({ field: c.field, threw: null });
    } catch (e) {
      out.push({ field: c.field, threw: e instanceof Error ? e.message : String(e) });
    } finally {
      console.error = original;
      cleanup();
    }
  }

  return out;
}
