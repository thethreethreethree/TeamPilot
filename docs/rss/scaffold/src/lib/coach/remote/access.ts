/**
 * Reporting tree (F2.4, F3.2, F3.4). The SQL function rss_can_view_rep() in
 * 0271_rss_p0_foundations.sql is what RLS enforces; this mirror is for server code that must
 * decide before querying (alert fan-out, inbox building). Tests keep the two in step.
 */
import { COMPANY_ADMINS_SEE_ALL } from './decisions';

export interface Person {
  id: string;
  companyId: string;
  managerId: string | null;
  isCompanyAdmin: boolean; // role in admin_roles() [OBSERVED 0265_admin_roles_single_source.sql:56]
  isSalesCoachManager: boolean; // sales_coach_role = 'admin' [OBSERVED 0072_sales_coach_role.sql:18]
}

export class TreeError extends Error {}

/** Everyone below `managerId`, at any depth. Throws on a loop (the DB trigger also refuses loops). */
export function reportsOf(managerId: string, people: Person[]): Set<string> {
  const byManager = new Map<string, string[]>();
  for (const p of people) {
    if (!p.managerId) continue;
    const list = byManager.get(p.managerId) ?? [];
    list.push(p.id);
    byManager.set(p.managerId, list);
  }
  const out = new Set<string>();
  const stack = [...(byManager.get(managerId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === managerId || out.has(id)) throw new TreeError(`Reporting loop through ${id}`);
    out.add(id);
    stack.push(...(byManager.get(id) ?? []));
  }
  return out;
}

export function canViewRep(viewer: Person, repId: string, people: Person[]): boolean {
  const rep = people.find((p) => p.id === repId);
  if (!rep || rep.companyId !== viewer.companyId) return false;
  if (viewer.id === repId) return true;
  if (viewer.isCompanyAdmin && COMPANY_ADMINS_SEE_ALL) return true;
  if (!viewer.isSalesCoachManager && !viewer.isCompanyAdmin) return false;
  return reportsOf(viewer.id, people).has(repId);
}

/** Manager chain above a rep, nearest first. Alerts (strong_session, deal_closed) go here,
 *  replacing today's fan-out to every manager in the company [OBSERVED notify.ts:7]. */
export function managerChain(repId: string, people: Person[]): string[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const chain: string[] = [];
  let cur = byId.get(repId)?.managerId ?? null;
  while (cur) {
    if (chain.includes(cur) || cur === repId) throw new TreeError(`Reporting loop through ${cur}`);
    chain.push(cur);
    cur = byId.get(cur)?.managerId ?? null;
  }
  return chain;
}

/** Validates a manager assignment before it reaches the DB (the trigger repeats these checks). */
export function assertValidManager(personId: string, managerId: string | null, people: Person[]): void {
  if (managerId === null) return;
  if (managerId === personId) throw new TreeError('A person cannot manage themselves');
  const person = people.find((p) => p.id === personId);
  const manager = people.find((p) => p.id === managerId);
  if (!person || !manager) throw new TreeError('Unknown person or manager');
  if (person.companyId !== manager.companyId) throw new TreeError('Manager must be in the same company');
  if (reportsOf(personId, people).has(managerId)) throw new TreeError('That would create a reporting loop');
}
