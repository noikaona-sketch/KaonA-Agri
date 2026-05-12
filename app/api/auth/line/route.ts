import { NextResponse } from 'next/server';

import {
  createServerSupabaseClient,
  ensureSupabaseAuthUser,
  getEffectiveRole,
  getLineChannelId,
  isAppRole,
  normalizeMember,
} from './line-auth-helpers';

import type { LineVerifyResponse, MemberRow, RoleRow } from './line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) return NextResponse.json({ error: 'Missing LINE ID token' }, { status: 400 });

    const lineChannelId = getLineChannelId();
    if (!lineChannelId) return NextResponse.json({ error: 'LINE channel id is not configured' }, { status: 500 });

    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: body.idToken, client_id: lineChannelId }),
    });

    if (!verifyResponse.ok) return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });

    const verifyData = (await verifyResponse.json()) as LineVerifyResponse;
    if (!verifyData.sub) return NextResponse.json({ error: 'LINE user id missing' }, { status: 401 });

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('members')
      .select('id, auth_user_id, line_user_id, status, full_name')
      .eq('line_user_id', verifyData.sub)
      .maybeSingle();

    if (existing.error) return NextResponse.json({ error: 'Failed to load member profile' }, { status: 500 });

    let member: MemberRow;

    if (existing.data) {
      member = existing.data;
    } else {
      const inserted = await supabase
        .from('members')
        .insert({ line_user_id: verifyData.sub, full_name: verifyData.name ?? 'LINE Member', citizen_id_masked: 'PENDING', status: 'pending' })
        .select('id, auth_user_id, line_user_id, status, full_name')
        .single();

      if (inserted.error || !inserted.data) return NextResponse.json({ error: 'Failed to create member profile' }, { status: 500 });
      member = inserted.data;

      await supabase.from('member_roles').upsert(
        { member_id: member.id, role: 'farmer', is_primary: true },
        { onConflict: 'member_id,role' }
      );
    }

    const authResult = await ensureSupabaseAuthUser(supabase, verifyData.sub, member.auth_user_id);
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 500 });

    if (!member.auth_user_id) {
      await supabase.from('members').update({ auth_user_id: authResult.authUserId }).eq('id', member.id);
      member = { ...member, auth_user_id: authResult.authUserId };
    }

    const rolesResult = await supabase.from('member_roles').select('role, is_primary').eq('member_id', member.id);
    if (rolesResult.error) return NextResponse.json({ error: 'Failed to load member roles' }, { status: 500 });

    const roleRows = (rolesResult.data ?? []) as RoleRow[];
    const roles = roleRows.map((r) => r.role).filter(isAppRole);
    const effectiveRole = getEffectiveRole(roleRows, roles);

    return NextResponse.json({
      member: normalizeMember(member, roles, effectiveRole),
      session: authResult.session,
      lineProfile: { name: verifyData.name ?? null, picture: null, email: null },
    });
  } catch (error) {
    console.error('[LINE_AUTH_ROUTE]', error);
    return NextResponse.json({ error: 'LINE authentication failed' }, { status: 500 });
  }
}
