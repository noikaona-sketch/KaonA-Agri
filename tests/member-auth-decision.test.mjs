import test from 'node:test';
import assert from 'node:assert/strict';

import { decideApprovedMemberAuth } from '../app/api/member/member-auth-decision.ts';

test('valid Supabase bearer updates own profile', () => {
  const decision = decideApprovedMemberAuth({
    bearer: { kind: 'approved', memberId: 'member-from-bearer' },
    hasExplicitIdentity: false,
    allowExplicitIdentity: false,
  });

  assert.deepEqual(decision, { ok: true, memberId: 'member-from-bearer' });
});

test('valid LINE id token updates own profile', () => {
  const decision = decideApprovedMemberAuth({
    lineIdToken: { kind: 'approved', memberId: 'member-from-line' },
    hasExplicitIdentity: false,
    allowExplicitIdentity: false,
  });

  assert.deepEqual(decision, { ok: true, memberId: 'member-from-line' });
});

test('invalid bearer does not fallback to member_id', () => {
  const decision = decideApprovedMemberAuth({
    bearer: { kind: 'invalid' },
    explicit: { kind: 'approved', memberId: 'member-from-query' },
    hasExplicitIdentity: true,
  });

  assert.deepEqual(decision, { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบก่อน' });
});

test('invalid LINE token does not fallback to line_user_id', () => {
  const decision = decideApprovedMemberAuth({
    lineIdToken: { kind: 'invalid' },
    explicit: { kind: 'approved', memberId: 'member-from-line-query' },
    hasExplicitIdentity: true,
  });

  assert.deepEqual(decision, { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบก่อน' });
});

test('unauthenticated PATCH returns 401', () => {
  const decision = decideApprovedMemberAuth({
    hasExplicitIdentity: false,
    allowExplicitIdentity: false,
  });

  assert.deepEqual(decision, { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบก่อน' });
});
