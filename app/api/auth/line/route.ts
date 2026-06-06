import { NextResponse } from 'next/server';

import {
  createServerSupabaseClient,
  getEffectiveRole,
  getLineChannelId,
  isAppRole,
  normalizeMember,
} from './line-auth-helpers';

import type { LineVerifyResponse, MemberRow, RoleRow } from './line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// resolveSession — core auth linking logic (issue #168)
//
// Design invariant:
//   The session returned to the client MUST belong to the same auth user that
//   is stored in members.auth_user_id.  Any mismatch is treated as a failure
//   so that RLS (auth.uid() = members.auth_user_id) is always coherent.
//
// Three cases handled:
//
//  A) existingAuthUserId is set AND the synthetic email already belongs to
//     that exact user  →  generateLink + verifyOtp, then assert user.id match.
//
//  B) existingAuthUserId is set BUT the synthetic email maps to a DIFFERENT
//     auth user (old anon-linked member whose email hasn't been provisioned)
//     →  do NOT issue a session; log the mismatch and return null so the
//        caller can signal the client gracefully (login works, no RLS).
//     →  document the required backfill in comments below.
//
//  C) No existingAuthUserId (new member or member with cleared auth_user_id)
//     →  admin.createUser with synthetic email, verifyOtp, assert match.
//
// Synthetic email schema:  line-<member_id>@kaona.internal
//   Deterministic, unique per member, never a real inbox.
// ─────────────────────────────────────────────────────────────────────────────

type SessionResult =
  | { ok: true;  authUserId: string; accessToken: string; refreshToken: string }
  | { ok: false; reason: string };

async function resolveSession(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  memberId: string,
  existingAuthUserId: string | null,
): Promise<SessionResult> {
  const syntheticEmail = `line-${memberId}@kaona.internal`;

  // ── Helper: exchange a hashed_token for a verified session ───────────────
  async function issueSessionViaLink(expectedUserId: string): Promise<SessionResult> {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return { ok: false, reason: `generateLink failed: ${linkError?.message ?? 'no token'}` };
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    });

    if (verifyError || !verifyData.session || !verifyData.user) {
      return { ok: false, reason: `verifyOtp failed: ${verifyError?.message ?? 'no session'}` };
    }

    // ── BLOCKER FIX 1 & 4: validate session user matches expected ──────────
    if (verifyData.user.id !== expectedUserId) {
      console.error(
        '[LINE_AUTH] session user mismatch:',
        `got=${verifyData.user.id} expected=${expectedUserId}`,
        '— refusing to return session',
      );
      return {
        ok:     false,
        reason: `session_user_mismatch: synthetic email maps to a different auth user`,
      };
    }

    return {
      ok:           true,
      authUserId:   verifyData.user.id,
      accessToken:  verifyData.session.access_token,
      refreshToken: verifyData.session.refresh_token,
    };
  }

  // ── CASE A & B: member already has an auth_user_id ───────────────────────
  if (existingAuthUserId) {
    // Check whether the synthetic email is already registered and who owns it.
    // We do this by attempting generateLink; the resulting user.id tells us
    // whether the email is already provisioned for this exact auth user.
    //
    // BLOCKER FIX 2: do NOT assume the synthetic email maps to existingAuthUserId.
    // Old anon-linked members have a random auth.uid that was never tied to
    // the synthetic email.  generateLink would create or retrieve a DIFFERENT
    // auth user for that email, giving us a mismatched session.
    //
    // Strategy: call issueSessionViaLink and let the mismatch check inside it
    // reject the session if the email belongs to a different user.
    //
    // BLOCKER FIX 3 (backfill note):
    //   Members whose auth_user_id was set by the old signInAnonymously() flow
    //   will hit case B (mismatch).  They will receive session: null in the
    //   response.  The client still gets their member record and can navigate
    //   as far as the API-route-guarded pages allow (service_role on server
    //   routes), but client-side Supabase queries that rely on auth.uid() will
    //   fail until the row is backfilled.
    //
    //   Backfill options (ops / admin task, not automated here):
    //     Option 1 — Reset: UPDATE members SET auth_user_id = NULL
    //                WHERE auth_user_id IN (
    //                  SELECT id FROM auth.users WHERE is_anonymous = true
    //                );
    //                On next login the member enters CASE C and gets a proper
    //                synthetic-email auth user.
    //     Option 2 — Reprovision: For each affected member run
    //                admin.updateUserById(existingAuthUserId, { email: syntheticEmail })
    //                so the existing anon user gains the synthetic email and
    //                generateLink starts returning the correct user.
    //     The migration 202605180001 documents Option 1 as the safe default.
    return issueSessionViaLink(existingAuthUserId);
  }

  // ── CASE C: new member — provision a fresh auth user ─────────────────────
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email:         syntheticEmail,
    email_confirm: true,
    user_metadata: { source: 'line', member_id: memberId },
  });

  if (createError) {
    // Race condition: another request already created the user.
    // Retrieve the existing one and validate ownership via mismatch check.
    if (
      createError.message?.includes('already registered') ||
      createError.message?.includes('already been registered')
    ) {
      console.warn('[LINE_AUTH] synthetic email already exists (race), listing users...');
      const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = listed?.users?.find((u) => u.email === syntheticEmail);
      if (!found) {
        return { ok: false, reason: 'race: synthetic email exists but cannot find user' };
      }
      // The found user should own this member — validate via issueSessionViaLink
      return issueSessionViaLink(found.id);
    }

    return { ok: false, reason: `createUser failed: ${createError.message}` };
  }

  if (!newUser?.user) {
    return { ok: false, reason: 'createUser returned no user' };
  }

  // Assert: the newly created user MUST own the synthetic email.
  // issueSessionViaLink will confirm via verifyData.user.id === newUser.user.id.
  return issueSessionViaLink(newUser.user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/line
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) {
      return NextResponse.json({ error: 'Missing LINE ID token' }, { status: 400 });
    }

    // ── DEV BYPASS ───────────────────────────────────────────────────────────
    if (body.idToken === 'dev-bypass-token') {
      const role = (body as Record<string, string>).devRole ?? 'farmer';
      const staffRoles = ['staff', 'admin', 'inspector', 'leader'];
      const devMemberId = staffRoles.includes(role)
        ? 'b26c6c2f-3005-4a3a-8a4d-01b8ac1ccfd7'
        : 'dev-mock-member-id';
      return NextResponse.json({
        member: {
          member_id:      devMemberId,
          auth_user_id:   null,
          line_user_id:   'dev-mock-line-id',
          full_name:      `Dev ${role}`,
          picture_url:    null,
          status:         'approved',
          is_approved:    true,
          effective_role: role,
          roles:          [role],
        },
        lineProfile: { name: `Dev ${role}`, picture: null, email: null },
        session: null,
      });
    }

    // ── 1. Verify LINE ID Token ───────────────────────────────────────────────
    const lineChannelId = getLineChannelId();
    if (!lineChannelId) {
      return NextResponse.json({ error: 'LINE channel id is not configured' }, { status: 500 });
    }

    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ id_token: body.idToken, client_id: lineChannelId }),
    });

    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });
    }

    const verifyData = (await verifyRes.json()) as LineVerifyResponse;
    if (!verifyData.sub) {
      return NextResponse.json({ error: 'LINE user id missing' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    // ── 2. Load or create member ──────────────────────────────────────────────
    const existing = await supabase
      .from('members')
      .select('id, auth_user_id, line_user_id, status, full_name, rejection_reason, line_picture_url')
      .eq('line_user_id', verifyData.sub)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({ error: 'Failed to load member profile' }, { status: 500 });
    }

    let member: MemberRow;

    if (existing.data) {
      member = existing.data;
      // Update LINE display fields on every login (best-effort; column may not exist yet)
      try {
        await supabase.from('members').update({
          line_display_name: verifyData.name    ?? null,
          line_picture_url:  verifyData.picture ?? null,
          updated_at:        new Date().toISOString(),
        }).eq('id', existing.data.id);
      } catch { /* column not yet migrated — skip */ }
    } else {
      // ── Check for admin_created member awaiting PIN link ─────────────────
      // ถ้ามี member ที่ admin สร้างไว้แต่ยังไม่มี LINE → ให้ไปกรอก PIN แทน
      const adminCreated = await supabase
        .from('members')
        .select('id')
        .eq('registration_type', 'admin_created')
        .is('line_user_id', null)
        .limit(1)
        .maybeSingle();

      // ไม่ได้ match กับ member ใดเลย — return status ให้ frontend redirect ไปหน้า PIN
      if (adminCreated.data) {
        return NextResponse.json({
          status: 'needs_pin',
          message: 'กรุณากรอก PIN ที่ได้รับจากเจ้าหน้าที่เพื่อเชื่อมบัญชี',
          line_user_id: verifyData.sub,
        }, { status: 200 });
      }

      // ── ไม่ auto-create member — ให้ไปกรอกข้อมูลสมัครก่อน ──────────────────
      // ส่งกลับ needs_register พร้อม line info เพื่อใช้ในหน้าสมัคร
      return NextResponse.json({
        status:           'needs_register',
        line_user_id:     verifyData.sub,
        line_display_name: verifyData.name    ?? null,
        line_picture_url:  verifyData.picture ?? null,
      }, { status: 200 });

      await supabase.from('member_roles').upsert(
        { member_id: member.id, role: 'farmer', is_primary: true },
        { onConflict: 'member_id,role' },
      );
    }

    // ── 3. Load roles ─────────────────────────────────────────────────────────
    const rolesResult = await supabase
      .from('member_roles')
      .select('role, is_primary')
      .eq('member_id', member.id);

    if (rolesResult.error) {
      return NextResponse.json({ error: 'Failed to load member roles' }, { status: 500 });
    }

    const roleRows    = (rolesResult.data ?? []) as RoleRow[];
    const roles       = roleRows.map((r) => r.role).filter(isAppRole);
    const effectiveRole = getEffectiveRole(roleRows, roles);

    // ── 4. Resolve Supabase Auth session (idempotent, mismatch-safe) ──────────
    let session:        { access_token: string; refresh_token: string } | null = null;
    let finalAuthUserId = member.auth_user_id;

    const sessionResult = await resolveSession(supabase, member.id, member.auth_user_id);

    if (sessionResult.ok) {
      session = {
        access_token:  sessionResult.accessToken,
        refresh_token: sessionResult.refreshToken,
      };

      // Link auth_user_id if this member didn't have one yet (CASE C)
      if (!member.auth_user_id) {
        const { error: linkError } = await supabase
          .from('members')
          .update({ auth_user_id: sessionResult.authUserId })
          .eq('id', member.id)
          .is('auth_user_id', null); // guard against races

        if (linkError) {
          console.error('[LINE_AUTH] failed to link auth_user_id:', linkError.message);
          // Session is still valid; auth_user_id link failed — non-fatal for this request,
          // next login will retry (member.auth_user_id is still null in DB).
        } else {
          finalAuthUserId = sessionResult.authUserId;
        }
      }
    } else {
      // BLOCKER FIX 4: do not return a session when it doesn't match the member
      console.warn('[LINE_AUTH] session not issued for member', member.id, '—', sessionResult.reason);
      session = null;
      // finalAuthUserId stays as-is (existing value preserved; not cleared here)
    }

    // ── 5. Build response ─────────────────────────────────────────────────────
    // Use finalAuthUserId so the client sees the post-link value, not stale null.
    const memberForResponse: MemberRow = { ...member, auth_user_id: finalAuthUserId };

    return NextResponse.json({
      member:      normalizeMember(memberForResponse, roles, effectiveRole),
      lineProfile: { name: verifyData.name ?? null, picture: null, email: null },
      session,
    });
  } catch (error) {
    console.error('[LINE_AUTH_ROUTE]', error);
    return NextResponse.json({ error: 'LINE authentication failed' }, { status: 500 });
  }
}


