import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const company="c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid="d5ed4699-f766-47e4-af7f-2161e5b087a7";
const base=`${company}/${sid}/chunks`;
const { data: files, error } = await sb.storage.from("assets-v1").list(base,{limit:1000, sortBy:{column:"name",order:"asc"}});
if(error){console.error("list err",error.message);process.exit(1);}
console.log(`chunks under ${base}: ${files.length}`);
let total=0;
const sizes = files.map(f=>({name:f.name, size:f.metadata?.size??0}));
for(const f of sizes){ total+=f.size; }
console.log("first 6:", sizes.slice(0,6));
console.log("last 3:", sizes.slice(-3));
console.log(`TOTAL bytes across chunks: ${total} (${(total/1024/1024).toFixed(2)} MB)`);
// header chunk = seq 0 present + non-trivial size?
const zero = sizes.find(s=>/(^|[^0-9])0(\.|_|$)/.test(s.name) || s.name.includes("-0.") || s.name.startsWith("0"));
console.log("seq-0-ish chunk:", zero || "NOT obviously found (names:"+sizes.slice(0,3).map(s=>s.name).join(",")+")");
// events for this session (capture/finalize telemetry)
const { data: evs } = await sb.from("events").select("kind, created_at").eq("subject",`sales_session:${sid}`).order("created_at").limit(30);
console.log("\nevents for sales_session:"+sid, (evs||[]).map(e=>`${e.kind}@${e.created_at?.slice(11,19)}`));
const { data: evs2 } = await sb.from("events").select("kind, created_at").ilike("subject",`%${sid}%`).order("created_at").limit(30);
console.log("events ilike:", (evs2||[]).map(e=>`${e.kind}`));
process.exit(0);
