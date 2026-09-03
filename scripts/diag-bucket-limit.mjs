import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data, error } = await sb.storage.getBucket("assets-v1");
if(error){console.error(error.message);process.exit(1);}
console.log("assets-v1 bucket:", JSON.stringify({ file_size_limit: data.file_size_limit, allowed_mime_types: data.allowed_mime_types, public: data.public }, null, 2));
console.log(`file_size_limit = ${data.file_size_limit} bytes = ${(data.file_size_limit/1024/1024).toFixed(1)} MB`);
console.log(`founder meeting stitched size = 37.29 MB → ${data.file_size_limit < 37.29*1024*1024 ? "EXCEEDS limit ✗" : "fits ✓"}`);
process.exit(0);
