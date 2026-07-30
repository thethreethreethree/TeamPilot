import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/notifications — derives a user's feed from the event chain (no notifications table). Previously
 * untested. The boundary pinned here is PRIVACY: the per-kind targeting filter must return only events aimed
 * at THIS user — a mention/assignment/participant-add for someone else must never surface in my feed, and my
 * own actions ("you opened the dialogue") aren't notifications. Also 401. The supabase client is faked.
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

type Ev = {
  id: string;
  kind: string;
  subject: string;
  actor: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
};

function fakeSb(o: {
  user?: { id: string } | null;
  profile?: { is_support_agent?: boolean; role?: string } | null;
  myTopics?: Array<{ topic_id: string }>;
  events?: Ev[];
}) {
  return {
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "me" } : o.user } }) },
    from: (t: string) => {
      if (t === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: o.profile ?? { is_support_agent: false, role: "member" } }) }),
            or: async () => ({ data: [] }), // actor-name resolution — irrelevant here
          }),
        };
      }
      if (t === "chat_participants") {
        return { select: () => ({ eq: () => ({ is: async () => ({ data: o.myTopics ?? [] }) }) }) };
      }
      if (t === "events") {
        return {
          select: () => ({
            in: () => ({ order: () => ({ limit: async () => ({ data: o.events ?? [], error: null }) }) }),
          }),
        };
      }
      if (t === "chat_topics") {
        return { select: () => ({ in: async () => ({ data: [] }) }) };
      }
      return {};
    },
  };
}

const mock = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const ids = async (res: Response) => ((await res.json()).notifications as Array<{ id: string }>).map((n) => n.id);
const ev = (id: string, kind: string, actor: string | null, payload: Record<string, unknown>): Ev => ({
  id,
  kind,
  subject: payload.subject as string ?? "x",
  actor,
  payload,
  occurred_at: "2026-07-01T10:00:00.000Z",
});

beforeEach(() => vi.clearAllMocks());

describe("GET /api/notifications — per-user targeting (privacy)", () => {
  it("401 unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await GET()).status).toBe(401);
  });

  it("returns a mention aimed at me, and NEVER one aimed at another user", async () => {
    mock(
      fakeSb({
        events: [
          ev("m-mine", "mention.created", "other", { target_user_id: "me" }),
          ev("m-other", "mention.created", "other", { target_user_id: "someone-else" }),
        ],
      })
    );
    expect(await ids(await GET())).toEqual(["m-mine"]);
  });

  it("task.participant_added: mine in; another user's out; my own self-add out", async () => {
    mock(
      fakeSb({
        events: [
          ev("t-mine", "task.participant_added", "boss", { added_user_id: "me" }),
          ev("t-other", "task.participant_added", "boss", { added_user_id: "other" }),
          ev("t-self", "task.participant_added", "me", { added_user_id: "me" }),
        ],
      })
    );
    expect(await ids(await GET())).toEqual(["t-mine"]);
  });

  it("care message_added surfaces only to the assigned agent, and only if a support agent", async () => {
    const events = [
      ev("c-mine", "care.conversation.message_added", "cust", { assigned_agent_id: "me" }),
      ev("c-other", "care.conversation.message_added", "cust", { assigned_agent_id: "other" }),
    ];
    // support agent → sees own-assigned only
    mock(fakeSb({ profile: { is_support_agent: true, role: "member" }, events }));
    expect(await ids(await GET())).toEqual(["c-mine"]);
    // non-agent → sees none of the care.* events
    mock(fakeSb({ profile: { is_support_agent: false, role: "member" }, events }));
    expect(await ids(await GET())).toEqual([]);
  });

  it("decision.opened: only when I'm an active participant AND not the actor", async () => {
    const events = [
      ev("d-inroom", "decision.opened", "other", { subject: "chat_topic:T1" }),
      ev("d-notinroom", "decision.opened", "other", { subject: "chat_topic:T9" }),
      ev("d-self", "decision.opened", "me", { subject: "chat_topic:T1" }),
    ];
    mock(fakeSb({ myTopics: [{ topic_id: "T1" }], events }));
    expect(await ids(await GET())).toEqual(["d-inroom"]);
  });
});
