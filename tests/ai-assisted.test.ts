/**
 * A privacy rule, tested as one.
 *
 * Showing this marker to a peer is the exact harm it exists to prevent, and it
 * would happen silently to the person least able to complain about it.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { LEADER_COMPANY_ROLES, canSeeAiAssisted, isLeader } from '@/lib/chat/ai-assisted';

const msg = (over = {}) => ({ authorId: 'author', aiAssisted: true, ...over });
const peer = { userId: 'someone-else', topicRole: 'member', companyRole: 'rep' };

test('a peer never sees that a teammate used the coach', () => {
  // THE rule. A rep is "afraid that others might see them incapable of
  // responding without AI guidance" — this is that fear, in code.
  assert.equal(canSeeAiAssisted(msg(), peer), false);
});

test('the author sees it on their own message', () => {
  assert.equal(
    canSeeAiAssisted(msg(), { userId: 'author', topicRole: 'member', companyRole: 'rep' }),
    true,
  );
});

test('a leader sees it, by topic role or by company role', () => {
  assert.equal(
    canSeeAiAssisted(msg(), { userId: 'x', topicRole: 'admin', companyRole: 'rep' }),
    true,
    'a topic admin',
  );
  for (const role of LEADER_COMPANY_ROLES) {
    assert.equal(
      canSeeAiAssisted(msg(), { userId: 'x', topicRole: 'member', companyRole: role }),
      true,
      `company role ${role}`,
    );
  }
});

test('a message that was not AI-assisted shows nothing, even to a leader', () => {
  assert.equal(
    canSeeAiAssisted(msg({ aiAssisted: false }), { userId: 'x', topicRole: 'admin', companyRole: 'CEO' }),
    false,
  );
});

test('an unknown viewer is treated as a peer, not as a leader', () => {
  // Fails CLOSED. Showing it to someone who should not see it cannot be undone;
  // hiding it from a leader costs them nothing they cannot get on the website.
  assert.equal(canSeeAiAssisted(msg(), { userId: null, topicRole: null, companyRole: null }), false);
});

test('two unknown identities are never treated as the same person', () => {
  // A null author and a null viewer must not match into "this is mine".
  assert.equal(
    canSeeAiAssisted(msg({ authorId: null }), { userId: null, topicRole: 'member', companyRole: 'rep' }),
    false,
  );
});

test('a system message with no author is not attributed to the viewer', () => {
  assert.equal(
    canSeeAiAssisted(msg({ authorId: null }), { userId: 'me', topicRole: 'member', companyRole: 'rep' }),
    false,
  );
});

test('a plain member is not a leader, whatever their topic role reads', () => {
  assert.equal(isLeader({ topicRole: 'member', companyRole: 'rep' }), false);
  assert.equal(isLeader({ topicRole: 'observer', companyRole: null }), false);
  assert.equal(isLeader({ topicRole: null, companyRole: 'sales' }), false);
});

test('the leader set matches the website exactly', () => {
  // Drift here silently changes who can see a colleague's private marker.
  assert.deepEqual([...LEADER_COMPANY_ROLES], ['CEO', 'CFO', 'COO', 'admin']);
});
