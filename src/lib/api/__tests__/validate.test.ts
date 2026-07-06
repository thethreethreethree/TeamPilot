import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "../validate";

/**
 * readBody guards the input of every POST route: malformed JSON and
 * schema-invalid bodies must be rejected with a 400 (not reach the handler),
 * and a valid body must pass through as typed data. This is a security-relevant
 * choke point, so its three outcomes are pinned here.
 */
const Schema = z.object({ name: z.string(), count: z.number().int() });

function jsonReq(body: string): NextRequest {
  return new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("readBody", () => {
  it("returns typed data for a valid body", async () => {
    const out = await readBody(jsonReq(JSON.stringify({ name: "a", count: 3 })), Schema);
    expect(out).not.toBeInstanceOf(NextResponse);
    expect(out).toEqual({ name: "a", count: 3 });
  });

  it("400s on malformed JSON", async () => {
    const out = await readBody(jsonReq("this is not json"), Schema);
    expect(out).toBeInstanceOf(NextResponse);
    const res = out as NextResponse;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid JSON/i);
  });

  it("400s with field issues on a schema mismatch", async () => {
    const out = await readBody(
      jsonReq(JSON.stringify({ name: 123, count: 1.5 })),
      Schema
    );
    expect(out).toBeInstanceOf(NextResponse);
    const res = out as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/validation failed/i);
    const paths = body.issues.map((i: { path: string }) => i.path);
    expect(paths).toContain("name"); // wrong type
    expect(paths).toContain("count"); // not an int
  });
});
