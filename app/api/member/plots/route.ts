import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const PLOT_SELECT = 'id,name,area_rai,lat,lng,accuracy,status,province,land_doc_type,created_at';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/plots
//
// Two modes (backward-compatible):
//
//  A) Session-based (preferred):
//     Header: Authorization: Bearer <access_token>
//     Resolves member_id server-side from token → returns caller's plots.
//
//  B) Query-param (legacy, preserved for existing callers):
//     ?member_id=<uuid>
//     Returns plots for the given member_id (no auth check — service_role).
//     Kept for backward compatibility with existing pages/components.
//
// Mode A takes priority when both are present.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    // ── Mode A: resolve from Bearer token ────────────────────────────────────
    const rawAuth = request.headers.get('Authorization') ?? '';
    const token   = rawAuth.replace('Bearer ', '').trim();

    if (token) {
      const { data: { user }, error: userError } = await s.auth.getUser(token);
      if (userError || !user) {
        return NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 });
      }

      const { data: memberRow } = await s
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!memberRow) {
        // Member not linked yet — return empty rather than error
        return NextResponse.json({ plots: [] });
      }

      const { data, error } = await s
        .from('plots')
        .select(PLOT_SELECT)
        .eq('member_id', memberRow.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ plots: data ?? [] });
    }

    // ── Mode B: legacy query-param (backward compat) ──────────────────────────
    const memberId = searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ plots: [] });

    const { data, error } = await s
      .from('plots')
      .select(PLOT_SELECT)
      .eq('member_id', memberId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plots: data ?? [] });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
