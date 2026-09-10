/**
 * Team Chat, read and written straight from the database.
 *
 * NO BACKEND CHANGE, and that is not luck — it is what the schema was built for.
 * Migration 0010 puts every rule in RLS rather than in a route:
 *
 *   chat_topics       select/insert where company_id = auth_company_id()
 *   chat_participants select for company members
 *   chat_messages     select AND insert only for a live participant of that
 *                     topic, and (0104) only with author_id = auth.uid()
 *
 * So the policy, not this file, decides what a rep can see and say. A bug here
 * cannot leak another company's chat or let anyone post as someone else — the
 * database refuses. That is why this reads Supabase directly instead of waiting
 * for an endpoint.
 *
 * MESSAGES ARE APPEND-ONLY AT THE DATABASE LEVEL. Migration 0010 installs rules
 * that make UPDATE and DELETE do nothing at all, because "the conversation
 * history is the source of truth for the diagnostic record". So this client
 * offers no edit and no delete — not as a simplification, but because offering
 * one would be a button that silently does nothing.
 *
 * TOPICS ARE COMPANY-WIDE, MESSAGES ARE NOT. A rep can see that a topic exists
 * and still not be able to read it — the messages policy is deliberately
 * stricter than the topics policy. The screen has to say that plainly rather
 * than showing an empty thread, which would read as "nobody has said anything".
 */
import { supabase } from '@/lib/supabase';
import type { TopicDecisionRow } from './topic-decision';
import type { TopicRole } from './close-topic';
import { byActivity } from './topic-order';

export type ChatTopic = {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed' | 'archived';
  createdAt: string;
  /**
   * Free-text tags, which exist to make a topic findable — the web's own
   * create-topic help says "pick tags so the topic is findable", and its list
   * searches them. Always an array: the column is `not null default '{}'`, but
   * a row read through a stale cache can still arrive without it.
   */
  tags: string[];
  /**
   * A private topic: only its participants can see or join it.
   *
   * NOT A POSTING GATE. Migration 0071 made locked topics participant-only —
   * RLS already hides them, so this is not a permission the app enforces. It is
   * a DISCLOSURE the app owes the rep: the website tells someone inside a locked
   * chat that teammates and admins cannot see it, AND that the coach still reads
   * it for coaching and diagnosis. A rep who believes a chat is private, and is
   * not told the system reads it, has been misled by omission.
   */
  locked: boolean;
  /**
   * Did the decision this topic reached actually hold?
   *
   * `held | reopened | partial | unknown`, or null when nobody has reviewed it.
   * This is the FOLLOW-THROUGH on a closed conversation, and it changes what a
   * closed topic means: a rep who reads a conclusion and acts on it should know
   * if that conclusion was later reopened. The website shows it on the closed
   * card; the phone was showing "wrapped up" and nothing else.
   */
  closeDurability: string | null;
  /** Everyone still in the topic. Readable for every topic — the participants
   *  policy is company-wide. */
  participants: number;
  /**
   * How many messages, and when the last one landed — or null.
   *
   * NULL IS NOT "NONE". The messages policy admits only live participants, so
   * these come back empty for a topic the rep is not in. Rendering that as
   * "0 messages" would tell them a busy topic is dead. Null means "not visible
   * to you", and the screen says which.
   */
  messages: number | null;
  lastMessageAt: string | null;
  /**
   * Is this rep a live participant?
   *
   * Decided from `chat_participants`, which is readable company-wide — so this
   * is knowable for every topic, including ones whose messages are hidden.
   */
  joined: boolean;
};

/**
 * One message in a topic.
 *
 * `kind` is 'message' for something a person wrote and 'system' for something
 * the product recorded — a close, a decision. The screen renders them
 * differently, so the distinction is carried rather than flattened.
 */
export type ChatMessage = {
  id: string;
  topicId: string;
  /** Null for a system message: nobody wrote it. */
  authorId: string | null;
  kind: string;
  body: string | null;
  /**
   * The message this one answers, or null.
   *
   * WITHOUT IT A THREAD READS AS A FLAT LIST, and that changes what messages
   * mean: "No, we shouldn't" under a reply arrow is an answer to one question,
   * and on its own it is a statement about the whole topic. The web renders the
   * parent above the reply; this app was not even selecting the column.
   */
  replyToId: string | null;
  /**
   * When the author changed it, or null.
   *
   * A message edited AFTER a rep read it is the quiet failure here: without a
   * marker the text simply differs from what they remember, and the natural
   * conclusion is that they misread it rather than that it changed.
   */
  editedAt: string | null;
  /**
   * An attachment's file reference, and its type.
   *
   * NOT A URL A PHONE CAN OPEN — the website resolves a signed URL on demand
   * from a files table. The app does not have that machinery, so it does not
   * pretend to: it says an attachment is there and where to open it. What it
   * must never do again is render an attachment as an EMPTY message, which is
   * what happened while these columns went unselected.
   */
  mediaUrl: string | null;
  mediaType: string | null;
  /**
   * Did the author use the coach to sharpen this message?
   *
   * WHO MAY SEE THIS IS NOT COSMETIC — see `ai-assisted.ts`. The web records the
   * founder's reasoning: peers must not see it, because a rep is "afraid that
   * others might see them incapable of responding without AI guidance". The
   * field is read for everyone; the SHOWING is gated.
   */
  aiAssisted: boolean;
  createdAt: string;
};

/**
 * How many topics this app reads.
 *
 * THE APP'S OWN BOUND, not the web's. The website does not cap this read at all
 * — it relies on PostgREST's default ceiling — so a company with more topics
 * than this sees all of them there and only these here. That is a divergence,
 * and it is deliberate: an unbounded list on a phone is a slow screen and a
 * large payload over a rep's data.
 *
 * It was 50, which a company reaches inside a year. 200 makes truncation
 * unlikely rather than merely possible, and the screen says so when it happens
 * — an unstated cut is the thing worth avoiding, not the cut itself.
 */
export const TOPIC_LIMIT = 200;

/** How many messages to fetch per topic. Newest last, as a thread reads. */
export const MESSAGE_LIMIT = 200;

export async function listTopics(userId: string): Promise<ChatTopic[]> {
  const { data, error } = await supabase
    .from('chat_topics')
    .select('id, title, description, status, created_at, tags, locked, close_durability')
    // Not filtered by status: a closed topic is still readable, and hiding it
    // would lose the record. It is simply not what a rep is usually looking for.
    .order('created_at', { ascending: false })
    .limit(TOPIC_LIMIT);
  if (error) throw error;

  const topics = (data ?? []).map((t) => ({
    id: t.id as string,
    title: (t.title as string) ?? 'Untitled',
    description: (t.description as string | null) ?? null,
    status: (t.status as ChatTopic['status']) ?? 'open',
    createdAt: t.created_at as string,
    // Never undefined downstream: the column is `not null default '{}'`, but a
    // row from a stale cache predating this select would arrive without it, and
    // search must not throw on an old row.
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    locked: t.locked === true,
    closeDurability: (t.close_durability as string | null) ?? null,
  }));
  if (topics.length === 0) return [];

  const ids = topics.map((t) => t.id);

  /**
   * THREE QUERIES FOR THE WHOLE LIST, not three per row.
   *
   * A count fetched inside a list row turns a screen of twenty topics into
   * sixty round trips on a phone with one bar. These are fetched once and
   * grouped in memory — which is also why they are `in(ids)` rather than a
   * per-topic call.
   */
  const [rosters, mine, activity] = await Promise.all([
    supabase.from('chat_participants').select('topic_id').in('topic_id', ids).is('left_at', null),
    supabase
      .from('chat_participants')
      .select('topic_id')
      .in('topic_id', ids)
      .eq('user_id', userId)
      .is('left_at', null),
    // Only rows the messages policy admits come back at all, which is exactly
    // the asymmetry the type documents.
    supabase.from('chat_messages').select('topic_id, created_at').in('topic_id', ids),
  ]);

  const participants = new Map<string, number>();
  for (const r of rosters.data ?? []) {
    const id = r.topic_id as string;
    participants.set(id, (participants.get(id) ?? 0) + 1);
  }

  const joined = new Set((mine.data ?? []).map((r) => r.topic_id as string));

  const counts = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const m of activity.data ?? []) {
    const id = m.topic_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const at = m.created_at as string;
    const held = latest.get(id);
    if (!held || at > held) latest.set(id, at);
  }

  /**
   * Ordered by ACTIVITY once the counts are in, not by the creation date the
   * query used.
   *
   * The honest limit of doing it here: the query takes the newest TOPIC_LIMIT
   * topics by creation date, so a very old topic that became busy this week
   * could fall outside that window and never be sorted into view. Fixing that
   * properly needs the server to order by last message, which would be a schema
   * or view change in someone else's product — so this sorts what it has and
   * says what it cannot do.
   */
  return byActivity(
    topics.map((t) => ({
      ...t,
      participants: participants.get(t.id) ?? 0,
      // Null, not zero, when the rep cannot see inside — see the type.
      messages: joined.has(t.id) ? (counts.get(t.id) ?? 0) : null,
      lastMessageAt: joined.has(t.id) ? (latest.get(t.id) ?? null) : null,
      joined: joined.has(t.id),
    })),
  );
}

/**
 * The messages in a topic — the NEWEST ones.
 *
 * THIS USED TO ASK FOR THE OLDEST. `.order('created_at', { ascending: true })`
 * with `.limit(200)` returns messages 1-200 of a 250-message topic, so a rep
 * opening a busy thread saw the beginning of it and never the fifty most recent
 * — including everything said that day. The thread appeared frozen: the poll
 * compares the last message it holds, which would have stayed message 200
 * forever, and the read-marker would have stamped that same message, so the
 * unread badge could never clear either.
 *
 * Asking for the newest and reversing gives the same chronological list a reader
 * expects, with the cut at the far end where an old message being out of reach
 * is merely inconvenient rather than invisible. The screen says when it happens;
 * see MESSAGE_LIMIT.
 */
export async function listMessages(topicId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, topic_id, author_id, kind, body, media_url, media_type, reply_to_id, ai_assisted, edited_at, created_at')
    .eq('topic_id', topicId)
    // Newest first for the CUT, reversed below for the READ.
    .order('created_at', { ascending: false })
    .limit(MESSAGE_LIMIT);
  if (error) throw error;
  return (data ?? []).reverse().map((m) => ({
    id: m.id as string,
    topicId: m.topic_id as string,
    authorId: (m.author_id as string | null) ?? null,
    kind: (m.kind as string) ?? 'message',
    body: (m.body as string | null) ?? null,
    replyToId: (m.reply_to_id as string | null) ?? null,
    editedAt: (m.edited_at as string | null) ?? null,
    mediaUrl: (m.media_url as string | null) ?? null,
    mediaType: (m.media_type as string | null) ?? null,
    aiAssisted: m.ai_assisted === true,
    createdAt: m.created_at as string,
  }));
}

/**
 * Am I a live participant of this topic?
 *
 * Asked BEFORE offering the composer. The insert policy would refuse a
 * non-participant anyway, but a rep who types a message and watches it fail has
 * lost what they wrote — the honest thing is not to offer the box.
 */
export async function amParticipant(topicId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chat_participants')
    .select('user_id')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .is('left_at', null)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * Post a message.
 *
 * `author_id` is sent explicitly as the caller's own id. It is not a formality:
 * migration 0104 requires `author_id = auth.uid()`, so a wrong value here is
 * refused by the database rather than accepted as a forged author.
 *
 * `company_id` must be sent too and must match the caller's company — the policy
 * checks it, and PostgREST has no default for a NOT NULL column.
 */
export async function sendMessage(input: {
  topicId: string;
  userId: string;
  companyId: string;
  body: string;
  /** The message being answered, or null for a top-level message. */
  replyToId?: string | null;
}): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      topic_id: input.topicId,
      company_id: input.companyId,
      author_id: input.userId,
      kind: 'message',
      body: input.body,
      // Null, not omitted: the column is nullable and a top-level message must
      // say so explicitly rather than relying on a PostgREST default.
      reply_to_id: input.replyToId ?? null,
    })
    .select('id, topic_id, author_id, kind, body, media_url, media_type, reply_to_id, ai_assisted, edited_at, created_at')
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    topicId: data.topic_id as string,
    authorId: (data.author_id as string | null) ?? null,
    kind: (data.kind as string) ?? 'message',
    body: (data.body as string | null) ?? null,
    replyToId: (data.reply_to_id as string | null) ?? null,
    editedAt: (data.edited_at as string | null) ?? null,
    mediaUrl: (data.media_url as string | null) ?? null,
    mediaType: (data.media_type as string | null) ?? null,
    aiAssisted: data.ai_assisted === true,
    createdAt: data.created_at as string,
  };
}

/**
 * Which messages in a topic are pinned.
 *
 * A PIN IS THE TEAM SAYING "THIS ONE MATTERS", and it was invisible on the
 * phone: pins live in their own table, `chat_pins`, and this app never read it.
 * A manager pinning the agreed price objection line would see it marked on the
 * website and not on the phone the rep actually carries.
 *
 * READABLE WITHOUT THE BACKEND BRANCH. The SELECT policy is
 * `company_id = auth_company_id()` — company-wide, like the participants table —
 * so this works today under RLS.
 *
 * `unpinned_at is null` IS DELIBERATE, and is not a divergence. The website
 * unpins by DELETING the row, so every pin it writes has a null `unpinned_at`
 * and the filter changes nothing today. The column exists for a soft-unpin the
 * schema anticipated; if that ever arrives, a phone without this filter would
 * show unpinned messages as pinned. Filtering costs nothing and cannot be wrong.
 *
 * A FAILURE RETURNS AN EMPTY SET, NOT AN ERROR. A pin is an annotation on a
 * conversation the rep can already read — losing the marks is worth far less
 * than losing the thread, so a pins failure must never take the topic down.
 */
export async function listPins(topicId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('chat_pins')
      .select('message_id')
      .eq('topic_id', topicId)
      .is('unpinned_at', null);
    if (error) return new Set();
    return new Set((data ?? []).map((r) => r.message_id as string));
  } catch {
    return new Set();
  }
}

/**
 * Start a topic, and join it.
 *
 * TWO INSERTS, AND THE SECOND IS NOT OPTIONAL. Creating a topic does not make
 * you a participant of it, and the MESSAGES policy admits only participants —
 * so a rep who created a topic and stopped there would be locked out of their
 * own conversation: unable to post, unable to read replies, with no error
 * anywhere explaining it. The roster row is what makes the topic usable.
 *
 * IF THE SECOND INSERT FAILS the topic still exists and is visible company-wide,
 * so nothing is lost — but the creator is not in it. That is reported rather
 * than swallowed, because it is precisely the state that would otherwise look
 * like a broken app.
 *
 * `role: 'admin'` for the creator, matching the schema's own vocabulary — they
 * opened it, so they can manage it on the website.
 */
export async function createTopic(input: {
  userId: string;
  companyId: string;
  title: string;
  description?: string | null;
}): Promise<{ topic: ChatTopic; joined: boolean }> {
  const { data, error } = await supabase
    .from('chat_topics')
    .insert({
      company_id: input.companyId,
      title: input.title,
      description: input.description?.trim() || null,
      created_by: input.userId,
    })
    .select('id, title, description, status, created_at, tags, locked, close_durability')
    .single();
  if (error) throw error;

  const topic: ChatTopic = {
    id: data.id as string,
    title: (data.title as string) ?? input.title,
    description: (data.description as string | null) ?? null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    locked: data.locked === true,
    closeDurability: (data.close_durability as string | null) ?? null,
    status: (data.status as ChatTopic['status']) ?? 'open',
    createdAt: data.created_at as string,
    participants: 1,
    messages: 0,
    lastMessageAt: null,
    joined: true,
  };

  const { error: joinError } = await supabase.from('chat_participants').insert({
    topic_id: topic.id,
    user_id: input.userId,
    role: 'admin',
  });
  if (joinError) {
    // The topic is real and company-visible; only the roster row is missing.
    return { topic: { ...topic, participants: 0, messages: null, joined: false }, joined: false };
  }
  return { topic, joined: true };
}

/**
 * Who wrote what, for the names on screen.
 *
 * One query for the whole thread rather than one per message — a fetch inside a
 * list row is how a chat of forty messages becomes forty round trips on a phone
 * that has one bar.
 */
export async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ids);
    if (error) return new Map();
    return new Map(
      (data ?? [])
        .filter((p) => typeof p.full_name === 'string' && p.full_name.trim())
        .map((p) => [p.id as string, (p.full_name as string).trim()]),
    );
  } catch {
    return new Map();
  }
}

/**
 * The decision attached to a topic, if there is one.
 *
 * NOTHING DEPLOYED IS NEEDED. `chat_topic_decisions` carries a company-wide
 * SELECT policy — its migration calls these "thread artifacts" that are "already
 * visible at the company level" — so this is the same direct-under-RLS read the
 * rest of chat uses.
 *
 * Returns null on any failure rather than throwing. A topic whose decision could
 * not be read must still show its messages; the conversation is the point, and
 * the card is context on top of it.
 */
export async function fetchTopicDecision(topicId: string): Promise<TopicDecisionRow | null> {
  try {
    const { data, error } = await supabase
      .from('chat_topic_decisions')
      .select('situation, phase, chosen_path, chosen_note, decided_at, opened_at')
      // A topic can carry several historical decided dialogues and at most one
      // open. Newest first so the card reflects where the topic is NOW.
      .eq('topic_id', topicId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as TopicDecisionRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * One topic's own row — its title and whether it is still open.
 *
 * WHY THIS WAS MISSING AND WHY IT MATTERED. The topic screen loaded only the
 * MESSAGES, so the header fell back to the static route title and every topic on
 * the phone was called "Topic". A rep with four conversations open could not
 * tell which one they were in, and could not tell that a topic had been closed.
 *
 * Company-wide SELECT, same as the list. Returns null rather than throwing: the
 * messages are the point, and a missing header must not take the thread down.
 */
export async function fetchTopicById(topicId: string): Promise<ChatTopic | null> {
  try {
    const { data, error } = await supabase
      .from('chat_topics')
      .select('id, title, description, status, created_at, tags, locked, close_durability')
      .eq('id', topicId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id as string,
      title: (data.title as string) ?? '',
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      locked: data.locked === true,
      closeDurability: (data.close_durability as string | null) ?? null,
      description: (data.description as string | null) ?? null,
      status: (data.status as ChatTopic['status']) ?? 'open',
      createdAt: data.created_at as string,
      participants: 0,
      messages: 0,
      lastMessageAt: null,
      joined: false,
    };
  } catch {
    return null;
  }
}

/**
 * This rep's role IN this topic, or null when they are not an active member.
 *
 * Separate from `amParticipant` because closing needs the ROLE, not merely
 * membership: `close_topic` accepts a per-topic 'admin' and refuses a 'member'.
 */
export async function myTopicRole(topicId: string, userId: string): Promise<TopicRole | null> {
  try {
    const { data, error } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('topic_id', topicId)
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle();
    if (error || !data) return null;
    const role = data.role as string;
    return role === 'admin' || role === 'member' || role === 'observer' ? role : null;
  } catch {
    return null;
  }
}

/**
 * Pin a message, or take a pin off.
 *
 * MIRRORS THE WEBSITE EXACTLY, including the part that is easy to get wrong:
 * `chat_pins.company_id` is NOT NULL and has no default, so the insert must
 * carry it. The website's own note records that an audit caught this missing
 * once. The company id comes from the caller's profile, which RLS guarantees
 * matches the topic's.
 *
 * UNPINNING DELETES THE ROW, which is how the website does it — existence is
 * what "pinned" means, and the `unpinned_at` column is vestigial. That is also
 * why the screen asks before doing it: this removes something the whole team
 * relies on, from a phone, one-handed, in the sun.
 *
 * Returns an error message rather than throwing. A rep who taps Pin and sees
 * nothing happen needs a sentence, not a crash — and the RLS policy can legally
 * refuse them (a non-participant may not pin), which is a real state and not a
 * fault.
 */
export async function setPinned(input: {
  topicId: string;
  messageId: string;
  companyId: string;
  userId: string;
  pinned: boolean;
}): Promise<string | null> {
  try {
    if (!input.pinned) {
      const { error } = await supabase
        .from('chat_pins')
        .delete()
        .eq('message_id', input.messageId);
      return error ? 'That pin could not be removed. Try again in a moment.' : null;
    }
    const { error } = await supabase.from('chat_pins').insert({
      topic_id: input.topicId,
      message_id: input.messageId,
      // NOT NULL with no default — the website was once bitten by omitting it.
      company_id: input.companyId,
      pinned_by: input.userId,
    });
    if (!error) return null;
    // A duplicate is not a failure: the message is pinned, which is what the
    // rep asked for. `unique (message_id)` makes this the ordinary race when
    // two people pin the same message at once.
    if ((error as { code?: string }).code === '23505') return null;
    return 'That could not be pinned. You may not be a member of this topic.';
  } catch {
    return 'That did not save. Check your signal and try again.';
  }
}

/**
 * Close a topic, recording what was decided.
 *
 * Calls the `close_topic` function rather than updating the row: the function
 * appends the system message, stamps closed_by/close_summary and resolves a
 * linked problem in ONE transaction. Updating `chat_topics.status` directly from
 * here would close the topic and silently skip all three.
 *
 * `security invoker`, so the caller's own identity is what the function checks —
 * nothing is deployed for this and nothing is trusted from the client.
 *
 * Returns an error message rather than throwing, because every failure here is
 * something the rep needs to read: they are mid-way through recording a decision.
 */
export async function closeTopic(topicId: string, summary: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('close_topic', {
      p_topic_id: topicId,
      p_summary: summary.trim(),
    });
    if (!error) return null;
    // The function raises plain-language exceptions ("Topic already closed",
    // "Only topic admins or company CEO/COO can close a topic"). Passing them
    // through beats a generic failure, because they say what to do next.
    return error.message || 'This topic could not be closed. Try again.';
  } catch {
    return 'This topic could not be closed. Check your connection and try again.';
  }
}

/**
 * The stored coach debrief for a closed topic, or null.
 *
 * Mirrors GET /api/coach/v5/debrief exactly: the caller's OWN most recent
 * `coach.debrief_generated` event for this topic. `actor = userId` is not
 * decoration — a debrief is written for the person who closed the conversation,
 * and showing one rep another's reflection would be a leak of someone's own
 * account of how they did.
 */
export async function fetchTopicDebrief(
  topicId: string,
  userId: string,
): Promise<unknown | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('payload')
      .eq('actor', userId)
      .eq('kind', 'coach.debrief_generated')
      .eq('subject', `chat_topic:${topicId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.payload ?? null;
  } catch {
    return null;
  }
}

/** The user ids of everyone currently in a topic. */
export async function participantIds(topicId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('topic_id', topicId)
      .is('left_at', null);
    if (error || !data) return [];
    return data.map((r) => r.user_id as string).filter(Boolean);
  } catch {
    return [];
  }
}
