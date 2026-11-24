import { describe, it, expect } from "vitest";
import { applyCommentRevisions } from "../commentRevisions";

const C = (id: string, body = "orig") => ({ id, timestampS: 5, body, createdAt: "2026-11-25T10:00:00Z", authorId: "m1" });

describe("applyCommentRevisions (0333)", () => {
  it("no revision: the comment as written", () => {
    expect(applyCommentRevisions([C("a")], [])).toEqual([{ ...C("a"), edited: false }]);
  });
  it("the latest edit wins and is marked edited", () => {
    const out = applyCommentRevisions([C("a")], [
      { commentId: "a", id: 2, body: "second", removed: false },
      { commentId: "a", id: 1, body: "first", removed: false },
    ]);
    expect(out).toEqual([{ ...C("a"), body: "second", edited: true }]);
  });
  it("a removal leaves the comment out; other comments stay", () => {
    expect(applyCommentRevisions([C("a"), C("b")], [{ commentId: "a", id: 1, body: null, removed: true }]).map((c) => c.id)).toEqual(["b"]);
  });
  it("an edit after a removal is not possible to undo by ordering mistakes: the highest id decides", () => {
    expect(applyCommentRevisions([C("a")], [
      { commentId: "a", id: 3, body: null, removed: true },
      { commentId: "a", id: 2, body: "x", removed: false },
    ])).toEqual([]);
  });
});
