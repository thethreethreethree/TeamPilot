/** Test harness: a fresh PGlite with the live-schema stub + every RSS migration, plus seed people. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
export const MIGRATIONS = readdirSync(join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();

// Fixed ids so failures are readable.
export const C1 = '00000000-0000-0000-0000-0000000000c1';
export const C2 = '00000000-0000-0000-0000-0000000000c2';
const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`;
export const CEO = u(1), M1 = u(2), M2 = u(3), R1 = u(4), R2 = u(5), X1 = u(9);
export const S1 = '00000000-0000-0000-0000-0000000005a1'; // R1, phone
export const S2 = '00000000-0000-0000-0000-0000000005a2'; // R2, video

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests', 'sql', 'fixtures', 'live-schema-stub.sql'), 'utf8'));
  for (const f of MIGRATIONS) await db.exec(readFileSync(join(root, 'supabase', 'migrations', f), 'utf8'));
  await db.exec(`
    insert into companies values ('${C1}', 'Client One'), ('${C2}', 'Client Two');
    insert into profiles (id, company_id, role, sales_coach_role) values
      ('${CEO}', '${C1}', 'ceo', null),
      ('${M1}', '${C1}', 'member', 'admin'),
      ('${M2}', '${C1}', 'member', 'admin'),
      ('${R1}', '${C1}', 'member', 'staff'),
      ('${R2}', '${C1}', 'member', 'staff'),
      ('${X1}', '${C2}', 'ceo', 'admin');
    update profiles set manager_id = '${CEO}' where id in ('${M1}', '${M2}');
    update profiles set manager_id = '${M1}' where id = '${R1}';
    update profiles set manager_id = '${M2}' where id = '${R2}';
    insert into coaching_sessions (id, company_id, agent_id, context) values
      ('${S1}', '${C1}', '${R1}', 'phone'), ('${S2}', '${C1}', '${R2}', 'video');
    insert into rubric_config (version, company_id, active) values ('attfiber-v1', '${C1}', true);
  `);
  return db;
}

/** Run as a signed-in user (role authenticated, auth.uid() = uid). Always resets afterwards. */
export async function as<T = Record<string, unknown>>(db: PGlite, uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await run<T>(db, sql);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Run as the server (Supabase service role bypasses RLS; here: the table owner). */
export async function asService<T = Record<string, unknown>>(db: PGlite, sql: string): Promise<T[]> {
  return run<T>(db, sql);
}

/** One statement -> query(); several -> exec(), returning the last statement's rows. */
async function run<T>(db: PGlite, sql: string): Promise<T[]> {
  if (sql.trim().replace(/;\s*$/, '').includes(';')) {
    const res = await db.exec(sql);
    return (res[res.length - 1]?.rows ?? []) as T[];
  }
  return (await db.query<T>(sql)).rows;
}
