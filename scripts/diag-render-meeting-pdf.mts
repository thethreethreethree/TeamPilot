// Render the meeting-review PDF HTML with the founder's REAL stored dissect, to verify the design visually.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildMeetingReviewHtml } from "../src/lib/coach/meeting/meetingReviewPdf";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });
const sid="d5ed4699-f766-47e4-af7f-2161e5b087a7";
const { data: ev } = await sb.from("events").select("payload").eq("subject",`meeting_session:${sid}`).eq("kind","meeting.dissect_generated").order("created_at",{ascending:false}).limit(1).maybeSingle();
const { data: s } = await sb.from("coaching_sessions").select("client_label, started_at").eq("id",sid).maybeSingle();
const html = buildMeetingReviewHtml(ev!.payload as any, { title: s!.client_label, dateISO: s!.started_at });
const out = process.argv[2] || "C:/Users/johns/AppData/Local/Temp/claude/c--Users-johns-OneDrive-Documents-GitHub-TeamPilot/000f2306-81f6-4d09-bc5c-972ec664d03e/scratchpad/meeting-review.html";
writeFileSync(out, html);
console.log("wrote", out, `(${html.length} bytes)`);
