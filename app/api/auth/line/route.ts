import { NextResponse } from 'next/server';

import {
  createServerSupabaseClient,
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

    // DEV BYPASS — token พิเศษ (ไม่ต้องพึ่ง build-time env)
    if (body.idToken === 'dev-bypass-token') {
      const role = (body as Record<string, string>).devRole ?? 'farmer';
      return NextResponse.json({
        member: {
          member_id:      'dev-mock-member-id',
          auth_user_id:   null,
          line_user_id:   'dev-mock-line-id',
          full_name:      `Dev ${role}`,
          status:         'approved',
          is_approved:    true,
          effective_role: role,
          roles:          [role],
        },
        lineProfile: { name: `Dev ${role}`, picture: null, email: null },
      });
    }

    const lineChannelId = getLineChannelId();
    if (!lineChannelId) return NextResponse.json({ error: 'LINE channel id is not configured' }, { status: 500 });

    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: body.idToken, client_id: lineChannelId }),
    });

    if (!verifyRes.ok) return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });

    const verifyData = (await verifyRes.json()) as LineVerifyResponse;
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
      // อัปเดต LINE display name และ picture ทุกครั้งที่ login
      try {
        await supabase.from('members').update({
          line_display_name: verifyData.name ?? null,
          line_picture_url:  verifyData.picture ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.data.id);
      } catch { /* column อาจยังไม่มี — ข้าม */ }
    } else {
      // สร้าง member ใหม่ — ลอง insert พร้อม LINE fields ก่อน
      let insertResult = await supabase
        .from('members')
        .insert({
          line_user_id:       verifyData.sub,
          full_name:          verifyData.name ?? 'LINE Member',
          line_display_name:  verifyData.name ?? null,
          line_picture_url:   verifyData.picture ?? null,
          citizen_id_masked:  'PENDING',
          status: 'pending',
        })
        .select('id, auth_user_id, line_user_id, status, full_name')
        .single();

      // ถ้า fail อาจเพราะ column ยังไม่มี — ลอง insert แบบ minimal
      if (insertResult.error) {
        console.error('[LINE_AUTH] insert with LINE fields failed:', insertResult.error.message, '— retrying minimal');
        insertResult = await supabase
          .from('members')
          .insert({
            line_user_id:      verifyData.sub,
            full_name:         verifyData.name ?? 'LINE Member',
            citizen_id_masked: 'PENDING',
            status: 'pending',
          })
          .select('id, auth_user_id, line_user_id, status, full_name')
          .single();
      }

      if (insertResult.error || !insertResult.data) {
        console.error('[LINE_AUTH] insert failed:', insertResult.error?.message);
        return NextResponse.json({
          error: `Failed to create member profile: ${insertResult.error?.message ?? 'unknown'}`,
        }, { status: 500 });
      }
      member = insertResult.data;

      await supabase.from('member_roles').upsert(
        { member_id: member.id, role: 'farmer', is_primary: true },
        { onConflict: 'member_id,role' }
      );
    }

    const rolesResult = await supabase
      .from('member_roles').select('role, is_primary').eq('member_id', member.id);

    if (rolesResult.error) return NextResponse.json({ error: 'Failed to load member roles' }, { status: 500 });

    const roleRows = (rolesResult.data ?? []) as RoleRow[];
    const roles = roleRows.map((r) => r.role).filter(isAppRole);
    const effectiveRole = getEffectiveRole(roleRows, roles);

    return NextResponse.json({
      member: normalizeMember(member, roles, effectiveRole),
      lineProfile: { name: verifyData.name ?? null, picture: null, email: null },
    });
  } catch (error) {
    console.error('[LINE_AUTH_ROUTE]', error);
    return NextResponse.json({ error: 'LINE authentication failed' }, { status: 500 });
  }
}
