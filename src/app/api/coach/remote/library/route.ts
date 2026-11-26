import { NextRequest, NextResponse } from "next/server";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { hiddenFrom } from "@/lib/coach/remote/hidePhrases";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { getSession } from "@/lib/data/salesCoach";
import { archivedFolderIds, canPlay, folderPathParts, FolderPathError, folderPaths, shareBySession, SnippetError, underArchived, validateSnippet } from "@/lib/coach/remote/library";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { assetUrlToStoragePath, signAssetUrl } from "@/lib/storage/assets";

/**
 * /api/coach/remote/library — Mine and Company (RSS Phase 5; docs/rss/docs/06-UI-SPEC.md "Library"; migration 0280).
 *
 *   GET ?scope=mine|company → { available, folders, items }
 *   POST { action: "add", scope, folderId?, folderName?, sessionId, clip?: { startMs, endMs, title }, note? }
 *        folderName works for BOTH scopes (2026-11-25, F12.6 / F9.16): a named folder of your own ("Listen later",
 *        "Objections") or a named company folder; found by name, created on first use. Default: "Mine" / "Team examples".
 *   POST { action: "remove", itemId }
 *
 * WHO SEES WHAT
 *   · Mine: what you put in your own folder, from calls you can open.
 *   · Company: managers create folders and add calls. A peer (not the rep, not a manager the 0273 tree lets see the
 *     rep) sees an item ONLY while the rep's consent stands — shareState's `shareable` verdict over 0260's log, via
 *     shareBySession. Revoked → gone for peers on the next read. A manager sees every item in their tree and, for
 *     one not yet approved, the words "Waiting on {rep}'s approval"; the add response says `needsApproval` and the
 *     panel asks the rep through the existing share route (one consent path, not two).
 *   · Audio is signed here only for a viewer who may play it (canPlay).
 *
 * Reads/writes use the service role, every statement pinned to the company (INV29); manager reach is asked of the
 * tree (treeFilterReps, INV36); adding requires the caller's own client to open the call (getSession).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "The library is waiting on database migration 0280.";

type Folder = { id: string; owner_id: string; is_company: boolean; name: string; parent_id: string | null };
type Item = { id: string; folder_id: string; session_id: string; snippet_id: string | null; rep_id: string; note: string | null; added_by: string; created_at: string };

/** Archived folders among `folderIds` (0346), from the append-only events; chunked; throws on a failed read. */
async function archivedFor(admin: ReturnType<typeof createAdminClient>, companyId: string, folderIds: string[]): Promise<Set<string>> {
  // Paged (review 2026-11-26): every event is read, so a folder's latest archive/restore is never cut off by a cap.
  const rows: Array<{ id: number; folder_id: string; kind: string }> = [];
  for (let i = 0; i < folderIds.length; i += 150) {
    const { data, error } = await fetchAllPagedResult<{ id: number; folder_id: string; kind: string }>(
      (from, to) => admin.from("library_folder_events").select("id, folder_id, kind").eq("company_id", companyId).in("folder_id", folderIds.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "library folder events", maxRows: 200_000 },
    );
    if (error) {
      if (/PGRST205|42P01|does not exist/.test(error.message)) return new Set();
      throw new Error(error.message);
    }
    rows.push(...(data ?? []));
  }
  return archivedFolderIds(rows);
}

async function signedAudio(audioAssetUrl: string | null): Promise<string | null> {
  const path = assetUrlToStoragePath(audioAssetUrl);
  if (path) return signAssetUrl({ storagePath: path, expiresInSeconds: 3600 });
  return audioAssetUrl?.startsWith("https://") ? audioAssetUrl : null;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-library", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope") === "company" ? "company" : "mine";
  const admin = createAdminClient();
  const isManager = (await requireSalesCoachManager(req)) !== null;

  let folderQuery = admin.from("library_folders").select("id, owner_id, is_company, name, parent_id").eq("company_id", ctx.companyId);
  folderQuery = scope === "company" ? folderQuery.eq("is_company", true) : folderQuery.eq("is_company", false).eq("owner_id", ctx.userId);
  const { data: folderRows, error: fErr } = await folderQuery.order("created_at", { ascending: true });
  if (fErr) {
    if (MISSING.has(String(fErr.code))) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[library] folder read failed: ${fErr.message}`);
    return NextResponse.json({ error: "Couldn't load the library." }, { status: 500 });
  }
  const allFolders = (folderRows ?? []) as Folder[];
  if (allFolders.length === 0) return NextResponse.json({ available: true, scope, isManager, folders: [], items: [] });
  // 0346 (F12.6): archived folders leave the list with their items (the calls stay in Search); they are listed apart so
  // they can be restored. A failed read is an error, never "nothing archived".
  let archived: Set<string>;
  try {
    archived = await archivedFor(admin, ctx.companyId, allFolders.map((f) => f.id));
  } catch (e) {
    console.error(`[library] folder archive read failed: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load the library." }, { status: 500 });
  }
  // 0353 (F12.6): folders nest. Each is shown by its full path; archiving a folder hides everything inside it too
  // (underArchived), and restoring it brings them back — the inner folders keep their own archive state.
  const paths = folderPaths(allFolders);
  const insideArchived = underArchived(allFolders, archived);
  const folders = allFolders.filter((f) => !archived.has(String(f.id)) && !insideArchived.has(String(f.id)));
  const canArchive = scope === "company" ? isManager : true;
  const folderList = allFolders
    .map((f) => ({
      id: f.id,
      name: paths.get(String(f.id)) ?? f.name,
      parentId: f.parent_id ?? null,
      archived: archived.has(String(f.id)),
      // Hidden because a folder above it is archived: not a place to save, and restored with that folder.
      insideArchived: insideArchived.has(String(f.id)),
      canArchive,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (folders.length === 0) return NextResponse.json({ available: true, scope, isManager, folders: folderList, items: [] });

  const { data: itemRows, error: iErr } = await admin
    .from("library_items")
    .select("id, folder_id, session_id, snippet_id, rep_id, note, added_by, created_at")
    .eq("company_id", ctx.companyId)
    .in("folder_id", folders.map((f) => f.id))
    .order("created_at", { ascending: false })
    .limit(300);
  if (iErr) {
    console.error(`[library] item read failed: ${iErr.message}`);
    return NextResponse.json({ error: "Couldn't load the library." }, { status: 500 });
  }
  const { data: removed } = await admin
    .from("library_item_removals")
    .select("item_id")
    .eq("company_id", ctx.companyId)
    .in("item_id", ((itemRows ?? []) as Item[]).map((i) => i.id));
  const gone = new Set(((removed ?? []) as Array<{ item_id: string }>).map((r) => String(r.item_id)));
  const items = ((itemRows ?? []) as Item[]).filter((i) => !gone.has(String(i.id)));

  const repIds = [...new Set(items.map((i) => String(i.rep_id)))];
  const sessionIds = [...new Set(items.map((i) => String(i.session_id)))];
  const snippetIds = items.map((i) => i.snippet_id).filter((x): x is string => !!x);
  const [visibleReps, consent, { data: sessions }, { data: snippets }, { data: people }] = await Promise.all([
    isManager ? treeFilterReps(req, repIds) : Promise.resolve([] as string[]),
    shareBySession(admin, ctx.companyId, sessionIds),
    admin.from("coaching_sessions").select("id, client_label, context, started_at, audio_asset_url").eq("company_id", ctx.companyId).in("id", sessionIds),
    snippetIds.length
      ? admin.from("snippets").select("id, start_ms, end_ms, title").eq("company_id", ctx.companyId).in("id", snippetIds)
      : Promise.resolve({ data: [] as unknown[] }),
    admin.from("profiles").select("id, full_name").eq("company_id", ctx.companyId).in("id", [...new Set([...repIds, ...items.map((i) => String(i.added_by))])]),
  ]);
  const canView = new Set(visibleReps);
  const sessionById = new Map(((sessions ?? []) as Array<{ id: string; client_label: string | null; context: string; started_at: string; audio_asset_url: string | null }>).map((s) => [String(s.id), s]));
  const snippetById = new Map(((snippets ?? []) as Array<{ id: string; start_ms: number; end_ms: number; title: string }>).map((s) => [String(s.id), s]));
  const nameById = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  // Hide-by-phrase (0337): a call hidden from this viewer never appears, whatever folder holds it — the same rule the
  // database applies (hiddenFrom → rss_call_hidden_for). A failed check shows nothing rather than a hidden call.
  let hidden: Set<string>;
  try {
    hidden = await hiddenFrom(admin, items.map((i) => String(i.session_id)), ctx.userId);
  } catch (e) {
    console.error(`[library] hidden check failed: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load the library." }, { status: 500 });
  }
  const out = [];
  for (const i of items) {
    if (hidden.has(String(i.session_id))) continue;
    const folder = folderById.get(String(i.folder_id));
    const viewerIsRep = String(i.rep_id) === ctx.userId;
    // From the tree only — NOT "I added it": a manager moved off a rep's chain must stop hearing their calls.
    const viewerCanViewRep = canView.has(String(i.rep_id));
    const shareable = consent.get(String(i.session_id))?.share.shareable ?? false;
    const inCompanyFolder = folder?.is_company === true;
    const playable = canPlay({ viewerIsRep, viewerCanViewRep, inCompanyFolder, shareable });
    // A peer never learns an unapproved item exists.
    if (!playable) continue;
    const s = sessionById.get(String(i.session_id));
    const snip = i.snippet_id ? snippetById.get(String(i.snippet_id)) : undefined;
    out.push({
      id: i.id,
      folderId: i.folder_id,
      folderName: folder ? paths.get(String(folder.id)) ?? folder.name : "",
      sessionId: i.session_id,
      callLabel: s?.client_label ?? null,
      channel: s?.context ?? null,
      callStartedAt: s?.started_at ?? null,
      repName: nameById.get(String(i.rep_id)) ?? null,
      addedByName: nameById.get(String(i.added_by)) ?? null,
      note: i.note,
      clip: snip ? { startMs: snip.start_ms, endMs: snip.end_ms, title: snip.title } : null,
      approved: inCompanyFolder ? shareable : null,
      pitchId: consent.get(String(i.session_id))?.pitchId ?? null,
      canOpenCall: viewerIsRep || viewerCanViewRep,
      canRemove: String(i.added_by) === ctx.userId || folder?.owner_id === ctx.userId || (inCompanyFolder && isManager && viewerCanViewRep),
      audioUrl: await signedAudio(s?.audio_asset_url ?? null),
      addedAt: i.created_at,
    });
  }
  return NextResponse.json({
    available: true,
    scope,
    isManager,
    folders: folderList,
    items: out,
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-library-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const admin = createAdminClient();

  if (body.action === "remove") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    if (!itemId) return NextResponse.json({ error: "Which item?" }, { status: 400 });
    const { data: item } = await admin
      .from("library_items")
      .select("id, folder_id, rep_id, added_by")
      .eq("company_id", ctx.companyId)
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    const { data: folder } = await admin
      .from("library_folders")
      .select("owner_id, is_company")
      .eq("company_id", ctx.companyId)
      .eq("id", item.folder_id)
      .maybeSingle();
    const managerMayRemove =
      folder?.is_company === true && (await requireSalesCoachManager(req)) !== null && (await treeFilterReps(req, [String(item.rep_id)])).length === 1;
    if (String(item.added_by) !== ctx.userId && folder?.owner_id !== ctx.userId && !managerMayRemove) {
      return NextResponse.json({ error: "Only whoever added it, the folder's owner or a manager can take it out." }, { status: 403 });
    }
    const { error } = await admin.from("library_item_removals").insert({ company_id: ctx.companyId, item_id: itemId, removed_by: ctx.userId });
    if (error) {
      console.error(`[library] remove failed item=${itemId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't remove it." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 0346 (F12.6): archive or restore a folder — a personal folder by its owner, a company folder by a manager.
  if (body.action === "archive" || body.action === "restore") {
    const folderId = typeof body.folderId === "string" ? body.folderId : "";
    if (!folderId) return NextResponse.json({ error: "Which folder?" }, { status: 400 });
    const { data: folder, error: fErr } = await admin.from("library_folders").select("id, owner_id, is_company").eq("company_id", ctx.companyId).eq("id", folderId).maybeSingle();
    if (fErr) {
      console.error(`[library] folder read failed: ${fErr.message}`);
      return NextResponse.json({ error: "Couldn't change the folder." }, { status: 500 });
    }
    if (!folder || (!folder.is_company && String(folder.owner_id) !== ctx.userId)) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    if (folder.is_company && (await requireSalesCoachManager(req)) === null) return NextResponse.json({ error: "Only a manager can archive a company folder." }, { status: 403 });
    const { error } = await admin.from("library_folder_events").insert({ company_id: ctx.companyId, folder_id: folderId, kind: body.action, actor_id: ctx.userId });
    if (error) {
      console.error(`[library] folder ${body.action} failed folder=${folderId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't change the folder." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, folderId, archived: body.action === "archive" });
  }

  if (body.action !== "add") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const scope = body.scope === "company" ? "company" : "mine";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  if (!sessionId) return NextResponse.json({ error: "Which call?" }, { status: 400 });

  // The caller must be able to open the call (RLS + tree).
  const session = await getSession(sessionId, callerScopedDb(req) ?? (await createClient()));
  if (!session) return NextResponse.json({ error: "Call not found or not accessible." }, { status: 404 });
  if (scope === "company" && (await requireSalesCoachManager(req)) === null) {
    return NextResponse.json({ error: "Only managers add to the company library." }, { status: 403 });
  }

  // Clip, when given.
  let clip: { startMs: number; endMs: number; title: string } | null = null;
  if (body.clip && typeof body.clip === "object") {
    const c = body.clip as Record<string, unknown>;
    const startMs = Number(c.startMs);
    const endMs = Number(c.endMs);
    const title = typeof c.title === "string" ? c.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ error: "Give the clip a title (up to 120 characters)." }, { status: 400 });
    const sessionSec = conversationDurationSeconds(session.audioDurationSeconds, session.startedAt, session.endedAt);
    const sessionMs = sessionSec === null ? null : sessionSec * 1000;
    try {
      validateSnippet(startMs, endMs, sessionMs);
    } catch (e) {
      if (e instanceof SnippetError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    clip = { startMs, endMs, title };
  }

  // Folder: a named company folder (existing id, or created by name), or the caller's own "Mine".
  let folderId: string | null = null;
  // Every folder on the path to the target (0353), so saving into a folder inside an archived one brings both back.
  const pathIds: string[] = [];
  if (scope === "company" && typeof body.folderId === "string") {
    const { data: f, error } = await admin
      .from("library_folders")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("is_company", true)
      .eq("id", body.folderId)
      .maybeSingle();
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    if (!f) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    folderId = String(f.id);
    pathIds.push(folderId);
  } else {
    // 0353 (F12.6): a name may be a path — "Objections / Pricing" — and each level is found or created inside the one
    // before it. No name: the library's default folder.
    let parts: string[];
    try {
      parts = typeof body.folderName === "string" && body.folderName.trim() ? folderPathParts(body.folderName) : [scope === "company" ? "Team examples" : "Mine"];
    } catch (e) {
      if (e instanceof FolderPathError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    let parent: string | null = null;
    for (const name of parts) {
      let lookup = admin
        .from("library_folders")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("is_company", scope === "company")
        .eq("name", name);
      lookup = parent ? lookup.eq("parent_id", parent) : lookup.is("parent_id", null);
      if (scope === "mine") lookup = lookup.eq("owner_id", ctx.userId);
      const { data: existing, error } = await lookup.order("created_at", { ascending: true }).limit(1);
      if (error) {
        if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
        console.error(`[library] folder lookup failed: ${error.message}`);
        return NextResponse.json({ error: "Couldn't add it." }, { status: 500 });
      }
      if (existing && existing.length > 0) parent = String((existing[0] as { id: string }).id);
      else {
        const parentId: string | null = parent;
        const { data: created, error: cErr }: { data: { id: string } | null; error: { message: string } | null } = await admin
          .from("library_folders")
          .insert({ company_id: ctx.companyId, owner_id: ctx.userId, is_company: scope === "company", name, parent_id: parentId })
          .select("id")
          .maybeSingle();
        if (cErr || !created) {
          console.error(`[library] folder create failed: ${cErr?.message ?? "no row"}`);
          return NextResponse.json({ error: "Couldn't add it." }, { status: 500 });
        }
        parent = String(created.id);
      }
      pathIds.push(parent);
    }
    folderId = parent;
  }

  // 0346: adding to an archived folder brings it back (it was found by name or id), rather than a hidden duplicate —
  // and (0353) any archived folder above it on the path, or the call would land somewhere still hidden.
  let restored = false;
  try {
    const archivedOnPath = await archivedFor(admin, ctx.companyId, pathIds);
    for (const id of [...new Set(pathIds)].filter((x) => archivedOnPath.has(x))) {
      const { error } = await admin.from("library_folder_events").insert({ company_id: ctx.companyId, folder_id: id, kind: "restore", actor_id: ctx.userId });
      if (error) throw new Error(error.message);
      restored = true;
    }
  } catch (e) {
    console.error(`[library] folder restore-on-add failed folder=${folderId}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't add it." }, { status: 500 });
  }

  let snippetId: string | null = null;
  if (clip) {
    const { data: snip, error } = await admin
      .from("snippets")
      .insert({
        company_id: ctx.companyId,
        session_id: sessionId,
        rep_id: session.agentId,
        start_ms: clip.startMs,
        end_ms: clip.endMs,
        title: clip.title,
        created_by: ctx.userId,
      })
      .select("id")
      .maybeSingle();
    if (error || !snip) {
      console.error(`[library] snippet insert failed: ${error?.message ?? "no row"}`);
      return NextResponse.json({ error: "Couldn't save the clip." }, { status: 500 });
    }
    snippetId = String(snip.id);
  }

  const { data: item, error: itemErr } = await admin
    .from("library_items")
    .insert({ company_id: ctx.companyId, folder_id: folderId, session_id: sessionId, snippet_id: snippetId, rep_id: session.agentId, note, added_by: ctx.userId })
    .select("id")
    .maybeSingle();
  if (itemErr || !item) {
    console.error(`[library] item insert failed: ${itemErr?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add it." }, { status: 500 });
  }

  let needsApproval = false;
  let pitchId: string | null = null;
  if (scope === "company" && session.agentId !== ctx.userId) {
    const c = (await shareBySession(admin, ctx.companyId, [sessionId])).get(sessionId);
    needsApproval = !(c?.share.shareable ?? false);
    pitchId = c?.pitchId ?? null;
  }
  return NextResponse.json({ item: { id: item.id, folderId, snippetId }, needsApproval, pitchId, restored });
}
