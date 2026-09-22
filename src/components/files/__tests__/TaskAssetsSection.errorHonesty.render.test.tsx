// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * A task's asset panel must not report a failed read as "No files attached yet".
 *
 * This is the same class the 2026-08-18 founder-directed sweep closed on the Sales-Coach Team page
 * ("an error dressed as no-data", INVARIANT 22) — and this panel survived that sweep. It is the
 * surface where it matters most: a task's asset list is where someone decides whether to go
 * looking for a document or give up on it, and "no files attached" ends the search.
 *
 * It was doubly wrong until 2026-09-22, because `listFiles` swallowed a failed read into `[]` and
 * the route answered **200**, so `filesRes.ok` was true and this panel never even saw the failure.
 * Both halves are fixed; this pins the surface half.
 */

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("../FileDropzone", () => ({ FileDropzone: () => null }));
vi.mock("../ClassificationModal", () => ({ ClassificationModal: () => null }));
vi.mock("../FileCard", () => ({
  FileCard: ({ file }: { file: { title: string } }) => <div>{file.title}</div>,
}));

import { TaskAssetsSection } from "../TaskAssetsSection";

const FILE = {
  id: "f1",
  title: "Q3 pricing sheet",
  description: null,
  storagePath: "p/f1",
  mimeType: "application/pdf",
  sizeBytes: 10,
  uploaderId: "u1",
  uploaderName: "Ada",
  classificationLane: "classified",
  createdAt: "2026-01-01T00:00:00Z",
  departmentIds: [],
  taskIds: ["t1"],
  tags: [],
};

/** `filesOk: false` is the route's 500 — the response the panel could not previously receive. */
function stubFetch(filesOk: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/files")) {
        return filesOk
          ? { ok: true, status: 200, json: async () => ({ files: [FILE], casual: { remaining: 3 } }) }
          : { ok: false, status: 500, json: async () => ({ error: "Couldn't load your files." }) };
      }
      return { ok: true, status: 200, json: async () => ({ departments: [], tasks: [] }) };
    })
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TaskAssetsSection — a failed read is not an empty task", () => {
  it("says the read failed instead of 'No files attached yet'", async () => {
    stubFetch(false);
    render(<TaskAssetsSection taskId="t1" />);
    await waitFor(() => expect(screen.getByText(/Couldn't load this task's files/)).toBeTruthy());
    // THE DEFECT. This sentence tells someone the task has nothing, and they stop looking.
    expect(screen.queryByText(/No files attached yet/)).toBeNull();
  });

  it("offers a retry, because a transient failure should not need a page reload", async () => {
    stubFetch(false);
    render(<TaskAssetsSection taskId="t1" />);
    await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
  });

  it("still shows the empty state when the read SUCCEEDS with nothing", async () => {
    // The distinction only works if both halves hold — an error state that also swallows the
    // genuine empty case has just moved the lie.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).startsWith("/api/files")
          ? { ok: true, status: 200, json: async () => ({ files: [], casual: { remaining: 3 } }) }
          : { ok: true, status: 200, json: async () => ({ departments: [], tasks: [] }) }
      )
    );
    render(<TaskAssetsSection taskId="t1" />);
    await waitFor(() => expect(screen.getByText(/No files attached yet/)).toBeTruthy());
    expect(screen.queryByText(/Couldn't load/)).toBeNull();
  });

  it("renders the files when the read succeeds", async () => {
    stubFetch(true);
    render(<TaskAssetsSection taskId="t1" />);
    await waitFor(() => expect(screen.getByText("Q3 pricing sheet")).toBeTruthy());
    expect(screen.queryByText(/Couldn't load/)).toBeNull();
  });
});
