import { readFileSync } from "node:fs"; import { createClient } from "@supabase/supabase-js";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {count}=await sb.from("agent_point_ledger").select("id",{count:"exact",head:true});
const {data:top}=await sb.from("agent_point_ledger").select("agent_id, points").eq("reason","session_score").limit(1000);
const byAgent={}; for(const r of top??[]){byAgent[r.agent_id]=(byAgent[r.agent_id]||0)+r.points;}
const ranked=Object.entries(byAgent).sort((a,b)=>b[1]-a[1]);
console.log(`ledger rows: ${count}; agents on the board: ${ranked.length}; top totals: ${ranked.slice(0,5).map(([,p])=>p).join(", ")}`);
process.exit(0);
