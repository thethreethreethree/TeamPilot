import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `getFile` must stay RLS-bound (cross-tenant file-bytes leak guard — A30).
 *
 * /api/files/[id] signs a storage download URL with the ADMIN client (signAssetUrl bypasses RLS for the
 * URL's TTL). Its ONLY access control is that `getFile(id)` returns null for a file the caller cannot
 * SELECT — which holds ONLY while getFile uses the RLS-bound user client (createClient). The route's own
 * comment warns: "If getFile is ever switched to the admin client, this silently becomes a cross-tenant
 * file-bytes leak (any authenticated user GETs any file id and receives a signed URL)." That was a
 * comment-only invariant; this pins it. files.ts legitimately uses createAdminClient elsewhere
 * (createFileRecord), so this is scoped to the getFile function body specifically.
 */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(here, "../files.ts"), "utf8");

/** The body of `export async function getFile` up to the next top-level export. */
function getFileBody(): string {
  const lines = SRC.split(/\r?\n/);
  const start = lines.findIndex((l) => /^export\s+(async\s+)?function\s+getFile\b/.test(l));
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^export\s/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

describe("getFile stays RLS-bound (files/[id] signed-URL access control)", () => {
  const body = getFileBody();

  it("the getFile function is found (the guard is anchored)", () => {
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/getFile/);
  });

  it("uses the RLS-bound user client (createClient)", () => {
    expect(body).toMatch(/\bcreateClient\b/);
  });

  it("does NOT use the admin client (createAdminClient bypasses RLS → cross-tenant file-bytes leak)", () => {
    expect(body).not.toMatch(/\bcreateAdminClient\b/);
  });
});
