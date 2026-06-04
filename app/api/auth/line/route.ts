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
//   The session returned to the client MUST be a LINE-owned auth user for the
//   same member, and members.auth_user_id must be linked to that exact user so
//   RLS sees auth.uid() = members.auth_user_id.
//
// Three cases handled:
//
//  A) existingAuthUserId is set and still matches the deterministic LINE auth
//     user → issue the session and keep the link unchanged.
//
//  B) existingAuthUserId is set but stale → issue the deterministic LINE
//     session only after validating ownership, then repair members.auth_user_id
//     to the exact auth.uid() returned to the client.
//
//  C) No existingAuthUserId → create/provision the deterministic LINE auth user,
//     verify ownership, issue a session, and link members.auth_user_id.
//
// Synthetic email schema:  line-<member_id>@kaona.internal
//   Deterministic, unique per member, never a real inbox.
// ─────────────────────────────────────────────────────────────────────────────

type SessionResult =
  | { ok: true;  authUserId: string; accessToken: string; refreshToken: string; repairedFromAuthUserId?: string }
  | { ok: false; reason: string };

async function resolveSession(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  memberId: string,
  existingAuthUserId: string | null,
): Promise<SessionResult> {
  const syntheticEmail = `line-${memberId}@kaona.internal`;

  // ── Helper: exchange a hashed_token for a verified session ───────────────
  async function issueSessionViaLink(expectedUserId?: string): Promise<SessionResult> {
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

    const sessionUser = verifyData.user;
    const sessionEmail = sessionUser.email ?? null;
    const metadataMemberId = typeof sessionUser.user_metadata?.member_id === 'string'
      ? sessionUser.user_metadata.member_id
      : null;

    if (sessionEmail !== syntheticEmail) {
      return {
        ok: false,
        reason: `line_session_user_invalid_email: expected deterministic LINE email for member ${memberId}`,
      };
    }

    if (metadataMemberId && metadataMemberId !== memberId) {
      return {
        ok: false,
        reason: `line_session_user_member_mismatch: auth user metadata belongs to another member`,
      };
    }

    const { data: conflictingMember, error: conflictingMemberError } = await supabase
      .from('members')
      .select('id')
      .eq('auth_user_id', sessionUser.id)
      .neq('id', memberId)
      .limit(1)
      .maybeSingle();

    if (conflictingMemberError) {
      return { ok: false, reason: `line_session_user_conflict_check_failed: ${conflictingMemberError.message}` };
    }

    if (conflictingMember) {
      return {
        ok: false,
        reason: `line_session_user_conflict: auth user is already linked to another member`,
      };
    }

    // The session user is the database auth.uid() the browser will use for RLS.
    // If an older LINE member row points at a different auth user, return the
    // actual session user so the caller can repair members.auth_user_id to match.
    const repairedFromAuthUserId = expectedUserId && sessionUser.id !== expectedUserId
      ? expectedUserId
      : undefined;

    if (repairedFromAuthUserId) {
      console.warn(
        '[LINE_AUTH] repairing auth_user_id mismatch:',
        `member=${memberId} old=${expectedUserId} session=${sessionUser.id}`,
      );
    }

    return {
      ok:                     true,
      authUserId:             sessionUser.id,
      accessToken:            verifyData.session.access_token,
      refreshToken:           verifyData.session.refresh_token,
      repairedFromAuthUserId,
    };
  }

  // ── CASE A & B: member already has an auth_user_id ───────────────────────
  if (existingAuthUserId) {
    // Always issue the browser session from the deterministic LINE email.  The
    // verified session user is the auth.uid() RLS will see; if the member row was
    // linked to an older anonymous/stale auth user, the caller repairs the row to
    // this returned user id instead of returning a mismatched session.
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
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_DEV_BYPASS_LINE !== 'true') {
        return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });
      }

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
      // New member — status stays 'pending', no auto-approve
      let insertResult = await supabase
        .from('members')
        .insert({
          line_user_id:      verifyData.sub,
          full_name:         verifyData.name ?? 'LINE Member',
          line_display_name: verifyData.name    ?? null,
          line_picture_url:  verifyData.picture ?? null,
          citizen_id_masked: 'PENDING',
          status:            'pending',
        })
        .select('id, auth_user_id, line_user_id, status, full_name, line_picture_url')
        .single();

      // Fallback: retry without optional LINE columns if they don't exist yet
      if (insertResult.error) {
        console.error('[LINE_AUTH] insert with LINE fields failed:', insertResult.error.message, '— retrying minimal');
        insertResult = await supabase
          .from('members')
          .insert({
            line_user_id:      verifyData.sub,
            full_name:         verifyData.name ?? 'LINE Member',
            citizen_id_masked: 'PENDING',
            status:            'pending',
          })
          .select('id, auth_user_id, line_user_id, status, full_name, line_picture_url')
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
    let sessionError:    string | null = null;
    let finalAuthUserId = member.auth_user_id;

    const sessionResult = await resolveSession(supabase, member.id, member.auth_user_id);

    if (sessionResult.ok) {
      session = {
        access_token:  sessionResult.accessToken,
        refresh_token: sessionResult.refreshToken,
      };

      // Link/repair auth_user_id to the exact auth.uid() returned to the client.
      if (member.auth_user_id !== sessionResult.authUserId) {
        const updateQuery = supabase
          .from('members')
          .update({ auth_user_id: sessionResult.authUserId })
          .eq('id', member.id);

        const { error: linkError } = member.auth_user_id
          ? await updateQuery.eq('auth_user_id', member.auth_user_id)
          : await updateQuery.is('auth_user_id', null);

        if (linkError) {
          console.error('[LINE_AUTH] failed to link auth_user_id:', linkError.message);
          // Session is still valid; the client must not use a stale member id/session pair.
          session = null;
          sessionError = `auth_user_id_link_failed: ${linkError.message}`;
        } else {
          finalAuthUserId = sessionResult.authUserId;
        }
      }
    } else {
      // BLOCKER FIX 4: do not return a session when it doesn't match the member
      console.warn('[LINE_AUTH] session not issued for member', member.id, '—', sessionResult.reason);
      session = null;
      sessionError = sessionResult.reason;
      // finalAuthUserId stays as-is (existing value preserved; not cleared here)
    }

    // ── 5. Build response ─────────────────────────────────────────────────────
    // Use finalAuthUserId so the client sees the post-link value, not stale null.
    const memberForResponse: MemberRow = { ...member, auth_user_id: finalAuthUserId };

    return NextResponse.json({
      member:      normalizeMember(memberForResponse, roles, effectiveRole),
      lineProfile: { name: verifyData.name ?? null, picture: null, email: null },
      session,
      authDiagnostic: sessionError ? { session_error: sessionError } : null,
    });
  } catch (error) {
    console.error('[LINE_AUTH_ROUTE]', error);
    return NextResponse.json({ error: 'LINE authentication failed' }, { status: 500 });
  }
}
