import { describe, it, expect } from 'vitest';
import { canViewRep, reportsOf, managerChain, assertValidManager, TreeError, type Person } from '../src/lib/coach/remote/access';

const P = (id: string, managerId: string | null, extra: Partial<Person> = {}): Person => ({ id, companyId: 'c1', managerId, isCompanyAdmin: false, isSalesCoachManager: false, ...extra });
const people: Person[] = [
  P('ceo', null, { isCompanyAdmin: true }),
  P('m1', 'ceo', { isSalesCoachManager: true }),
  P('m2', 'ceo', { isSalesCoachManager: true }),
  P('r1', 'm1'),
  P('r2', 'm2'),
  P('lead', 'm1', { isSalesCoachManager: true }),
  P('r3', 'lead'),
  { id: 'x1', companyId: 'c2', managerId: null, isCompanyAdmin: true, isSalesCoachManager: true },
];
const get = (id: string) => people.find((p) => p.id === id)!;

describe('reporting tree', () => {
  it('a manager sees direct and indirect reports', () => {
    expect([...reportsOf('m1', people)].sort()).toEqual(['lead', 'r1', 'r3']);
    expect(canViewRep(get('m1'), 'r3', people)).toBe(true);
  });
  it('a manager does not see another manager\'s team (today they see everyone)', () => {
    expect(canViewRep(get('m1'), 'r2', people)).toBe(false);
  });
  it('a rep sees only themselves', () => {
    expect(canViewRep(get('r1'), 'r1', people)).toBe(true);
    expect(canViewRep(get('r1'), 'r3', people)).toBe(false);
  });
  it('a company admin sees everyone in their company (D2 stand-in) but not another company', () => {
    expect(canViewRep(get('ceo'), 'r2', people)).toBe(true);
    expect(canViewRep(get('x1'), 'r1', people)).toBe(false);
  });
  it('alerts go up the chain, nearest first', () => {
    expect(managerChain('r3', people)).toEqual(['lead', 'm1', 'ceo']);
  });
  it('accepts a valid manager and refuses self, cross-company and loops', () => {
    expect(() => assertValidManager('r2', 'm1', people)).not.toThrow();
    expect(() => assertValidManager('r1', 'r1', people)).toThrow(TreeError);
    expect(() => assertValidManager('r1', 'x1', people)).toThrow(/same company/);
    expect(() => assertValidManager('m1', 'r3', people)).toThrow(/loop/);
  });
});
