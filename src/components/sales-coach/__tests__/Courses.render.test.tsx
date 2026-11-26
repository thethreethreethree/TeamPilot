// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * Training courses (F17.1, 2026-11-26): a rep reads lessons in order and marking one done opens the next; a manager's
 * new course goes straight to Assign; nothing assigned renders nothing; a failed read is said.
 */
import { AssignedCourses } from "../AssignedCourses";
import { CourseManager } from "../CourseManager";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe("AssignedCourses", () => {
  it("marking a lesson done opens the next one; finishing says so", async () => {
    let done: string[] = [];
    const course = () => ({
      id: "a1", title: "Discovery", summary: null, assignedByName: "Max", dueAt: "2999-01-01T00:00:00Z",
      done: done.length, total: 2, state: done.length === 2 ? "done" : done.length ? "in_progress" : "not_started",
      steps: [{ uid: "u1", title: "Open well", body: "Ask before you pitch.", done: done.includes("u1") }, { uid: "u2", title: "Dig", body: "Ask why twice.", done: done.includes("u2") }],
    });
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "PUT") {
        done = [...done, JSON.parse(init.body!).stepUid];
        return ok({ ok: true });
      }
      return ok({ available: true, assignments: [course()] });
    }));
    render(<AssignedCourses />);
    fireEvent.click(await screen.findByText("Discovery"));
    expect(screen.getByText("Ask before you pitch.")).toBeTruthy(); // the first lesson not done opens
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    await screen.findByText("Ask why twice.");
    expect(screen.queryByText("Ask before you pitch.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    await screen.findByText("You finished “Discovery”.");
    expect(screen.getByText(/2 of 2 steps · Done/)).toBeTruthy();
  });
  it("nothing assigned renders nothing; a failed read is said", async () => {
    vi.stubGlobal("fetch", vi.fn(() => ok({ available: true, assignments: [] })));
    const { container } = render(<AssignedCourses />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => ok({}, 500)));
    render(<AssignedCourses />);
    await screen.findByText(/Couldn't load your courses/);
  });
});

describe("AssignedCourses — practice steps (0357)", () => {
  it("a practice step links to its practice and has no Mark done; one not yet assigned says so", async () => {
    const steps = [
      { uid: "p1", title: "Try the opener", body: "", done: false, kind: "practice", practiceAssignmentId: "ta1", practiceState: "due" },
      { uid: "p2", title: "Handle price", body: "", done: false, kind: "practice", practiceAssignmentId: null, practiceState: null },
    ];
    vi.stubGlobal("fetch", vi.fn(() => ok({ available: true, assignments: [{ id: "a1", title: "Discovery", summary: null, assignedByName: null, dueAt: "2999-01-01T00:00:00Z", done: 0, total: 2, state: "not_started", steps }] })));
    render(<AssignedCourses />);
    fireEvent.click(await screen.findByText("Discovery"));
    expect(screen.getByRole("link", { name: "Practice it" }).getAttribute("href")).toBe("/dashboard/remote-sales/practice?assignment=ta1");
    expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
    fireEvent.click(screen.getByText("Handle price"));
    expect(screen.getByText("Not assigned to you yet — ask your manager.")).toBeTruthy();
  });
});

describe("AssignedCourses — lesson content (0359)", () => {
  it("a lesson links to its library call (company tab, with the way back) and opens an outside link in a new tab", async () => {
    const steps = [{ uid: "u1", title: "Watch first", body: "Listen to how she opens.", done: false, kind: "lesson", libraryItemId: "li1", linkUrl: "https://loom.com/share/x" }];
    vi.stubGlobal("fetch", vi.fn(() => ok({ available: true, assignments: [{ id: "a1", title: "Discovery", summary: null, assignedByName: null, dueAt: "2999-01-01T00:00:00Z", done: 0, total: 1, state: "not_started", steps }] })));
    render(<AssignedCourses />);
    fireEvent.click(await screen.findByText("Discovery"));
    expect(screen.getByRole("link", { name: "Listen in the library" }).getAttribute("href")).toBe("/dashboard/remote-sales/library?scope=company&item=li1&from=training");
    const out = screen.getByRole("link", { name: "Open link" });
    expect(out.getAttribute("href")).toBe("https://loom.com/share/x");
    expect(out.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("CourseManager", () => {
  it("a new course is saved with its lessons in order, then Assign opens for it", async () => {
    const posts: Array<[string, unknown]> = [];
    let saved = false;
    vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push([u, JSON.parse(init.body!)]);
        saved = true;
        return ok({ id: "k1", version: 1 });
      }
      if (u === "/api/team") return ok({ members: [{ id: "r1", full_name: "Rae" }] });
      if (u.startsWith("/api/coach/remote/course-assignments")) return ok({ assignments: [] });
      return ok({ available: true, courses: saved ? [{ id: "k1", title: "Discovery", summary: null, retired: false, version: 1, steps: [{ uid: "x", title: "B", body: "b" }, { uid: "y", title: "A", body: "a" }] }] : [] });
    }));
    render(<CourseManager />);
    fireEvent.click(await screen.findByRole("button", { name: "New course" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Discovery" } });
    fireEvent.change(screen.getByLabelText("Lesson 1 title"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Lesson 1 text"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));
    fireEvent.change(screen.getByLabelText("Lesson 2 title"), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText("Lesson 2 text"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Move lesson 2 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    await screen.findByLabelText("Assign Discovery");
    expect(posts[0]![1]).toMatchObject({ title: "Discovery", steps: [{ title: "B", body: "b" }, { title: "A", body: "a" }] });
    expect(screen.getByText("Course saved — now pick who takes it.")).toBeTruthy();
  });
});
