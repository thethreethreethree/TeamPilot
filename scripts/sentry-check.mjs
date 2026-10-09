#!/usr/bin/env node
/**
 * Send ONE test event to a Sentry DSN and report whether Sentry accepted it (2026-10-08).
 *
 * Why: /api/health's errorReporting flag proves the DSN is SET in production, not that events ARRIVE. A wrong DSN,
 * a deleted project or a filtered key would leave the flag true and Sentry empty, and the first real outage would
 * reach nobody (docs/CONFIG-PRECONDITIONS-AUDIT.md, Sentry step 4). This closes that gap without waiting for a real
 * error and without breaking anything in production.
 *
 *   node scripts/sentry-check.mjs <DSN>          (or SENTRY_CHECK_DSN=<DSN>)
 *
 * Uses Sentry's public store endpoint over plain HTTPS (no SDK). Exit 0 = Sentry took the request; exit 1 = refused
 * or unreachable; exit 2 = not a DSN.
 *
 * WHAT A 200 DOES NOT PROVE (measured 2026-10-08): Sentry's ingest answered 200 with an event id for a MADE-UP key
 * and project, and drops such events later. So exit 0 proves the request reached Sentry, not that the project kept
 * it. The proof is the event "ELOSTATE Sentry setup check" appearing in the project's Issues; the script says so
 * rather than claiming more than it can see.
 */
export function parseDsn(dsn) {
  let u;
  try {
    u = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = u.pathname.replace(/^\/+|\/+$/g, "").split("/").pop();
  if (!u.username || !projectId || !/^\d+$/.test(projectId)) return null;
  return { key: u.username, host: u.host, protocol: u.protocol, projectId };
}

async function main() {
  const dsn = process.argv[2] ?? process.env.SENTRY_CHECK_DSN;
  const parsed = dsn ? parseDsn(dsn) : null;
  if (!parsed) {
    console.error("Not a Sentry DSN. Expected https://<key>@o<org>.ingest.sentry.io/<project-id>");
    process.exit(2);
  }
  const url = `${parsed.protocol}//${parsed.host}/api/${parsed.projectId}/store/`;
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "info",
    message: { formatted: "ELOSTATE Sentry setup check" },
    tags: { check: "setup" },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=elostate-sentry-check/1.0`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(
        `SENT (${res.status}): event ${event.event_id}. Sentry answers 200 even for an unknown key, so this is not ` +
          `proof yet: open the project's Issues and look for "ELOSTATE Sentry setup check".`
      );
      process.exit(0);
    }
    console.error(`REFUSED (${res.status}): ${text.slice(0, 300)}`);
    process.exit(1);
  } catch (e) {
    console.error(`UNREACHABLE: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("sentry-check.mjs")) {
  await main();
}
