#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const accessToken = process.env.SUPABASE_TEST_ACCESS_TOKEN;

const missing = [
  ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY', anonKey],
  ['SUPABASE_TEST_ACCESS_TOKEN', accessToken],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.warn(
    `[plot-registration-rls] Skipping integration test; missing env: ${missing.join(', ')}.`,
  );
  console.warn(
    '[plot-registration-rls] Set SUPABASE_TEST_ACCESS_TOKEN to an approved member session access token.',
  );
  process.exit(0);
}

const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const scopedClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
if (userError || !userData.user) {
  throw new Error(`Test access token is invalid: ${userError?.message ?? 'no user returned'}`);
}

const authUserId = userData.user.id;

const { data: member, error: memberError } = await scopedClient
  .from('members')
  .select('id, auth_user_id, status')
  .eq('auth_user_id', authUserId)
  .maybeSingle();

if (memberError) {
  throw new Error(`Failed to resolve member through user-scoped client: ${memberError.message}`);
}
if (!member) {
  throw new Error(`No visible member maps to auth.uid() ${authUserId}; check members.auth_user_id.`);
}
if (member.auth_user_id !== authUserId) {
  throw new Error(`Member auth_user_id mismatch: got ${member.auth_user_id}, expected ${authUserId}`);
}
if (member.status !== 'approved') {
  throw new Error(`Test member must be approved before plot creation; got status ${member.status}`);
}

const uniqueSuffix = new Date().toISOString();
const insertPayload = {
  member_id: member.id,
  name: `RLS integration plot ${uniqueSuffix}`,
  area_rai: 1,
  lat: 14.1234567,
  lng: 101.1234567,
  accuracy: 5,
  status: 'pending_review',
  created_by: member.id,
  role_used: 'farmer',
  timestamp: uniqueSuffix,
};

const { data: plot, error: insertError } = await scopedClient
  .from('plots')
  .insert(insertPayload)
  .select('id, member_id, created_by, status')
  .single();

if (insertError || !plot) {
  throw new Error(
    `User-scoped plot insert failed; auth.uid() may not be propagated: ${insertError?.message ?? 'no row returned'}`,
  );
}

try {
  if (plot.member_id !== member.id || plot.created_by !== member.id) {
    throw new Error(
      `Inserted plot ownership mismatch: member_id=${plot.member_id}, created_by=${plot.created_by}, expected=${member.id}`,
    );
  }

  console.log(
    `[plot-registration-rls] PASS auth.uid() ${authUserId} maps to member ${member.id} and can insert own plot ${plot.id}.`,
  );
} finally {
  const { error: cleanupError } = await scopedClient
    .from('plots')
    .delete()
    .eq('id', plot.id)
    .eq('member_id', member.id);

  if (cleanupError) {
    console.warn(
      `[plot-registration-rls] Cleanup warning: delete plot ${plot.id} manually (${cleanupError.message}).`,
    );
  }
}
