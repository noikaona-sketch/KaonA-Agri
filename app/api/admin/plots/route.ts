import { NextResponse }               from 'next/server';
import { createAnonSupabaseClient, createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

const PLOT_ADMIN_STAFF_ROLES = ['admin', 'staff', 'service_account'] as const;

type PlotAdminStaffActor =
  | { kind: 'admin_web'; actorId: string }
  | { kind: 'field_member'; actorId: string };

async function resolveFieldStaffFromBearer(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<PlotAdminStaffActor | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const anon = createAnonSupabaseClient();
  const { data: { user } } = await anon.auth.getUser(token);

  let memberId: string | null = null;
  if (user?.id) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    memberId = member?.status === 'approved' ? (member.id as string) : null;
  } else {
    const { data: session } = await s
      .from('sessions')
      .select('member_id, members:member_id(status)')
      .eq('token', token)
      .maybeSingle();
    const sessionRow = session as {
      member_id?: string | null;
      members?: { status?: string } | { status?: string }[] | null;
    } | null;
    const memberStatus = Array.isArray(sessionRow?.members)
      ? sessionRow?.members[0]?.status
      : sessionRow?.members?.status;
    memberId = memberStatus === 'approved' ? sessionRow?.member_id ?? null : null;
  }

  if (!memberId) return null;

  const { data: role } = await s
    .from('member_roles')
    .select('role')
    .eq('member_id', memberId)
    .in('role', [...PLOT_ADMIN_STAFF_ROLES])
    .limit(1)
    .maybeSingle();

  return role ? { kind: 'field_member', actorId: memberId } : null;
}

async function requirePlotAdminOrFieldStaff(request: Request): Promise<PlotAdminStaffActor | null> {
  const admin = await requireAdmin();
  if (admin) return { kind: 'admin_web', actorId: admin.adminUserId };

  const s = createServerSupabaseClient();
  return resolveFieldStaffFromBearer(request, s);
}

const PLOT_SELECT = `
  id, member_id, name, area_rai, lat, lng, accuracy, status,
  province, district, subdistrict, village,
  land_doc_type, land_doc_number, description,
  boundary_geojson, area_rai_calculated,
  created_at, updated_at,
  member:member_id(id, full_name, phone, line_display_name)
`;

// ── GET /api/admin/plots ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const actor = await requirePlotAdminOrFieldStaff(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const s   = createServerSupabaseClient();
  const url = new URL(request.url);
  const memberId = url.searchParams.get('member_id') ?? '';

  let q = s.from('plots')
    .select(PLOT_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (memberId) q = q.eq('member_id', memberId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plots: data ?? [] });
}

// ── POST /api/admin/plots ─────────────────────────────────────────────────────
// Admin or authorized field staff creates a plot for any approved member, or leaves it unassigned.
export async function POST(request: Request) {
  const actor = await requirePlotAdminOrFieldStaff(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      member_id?:    string | null;
      name:          string;
      area_rai:      number;
      lat?:          number | null;
      lng?:          number | null;
      accuracy?:     number | null;
      province?:     string | null;
      district?:     string | null;
      subdistrict?:  string | null;
      village?:      string | null;
      land_doc_type?:   string | null;
      land_doc_number?: string | null;
      description?:  string | null;
      status?:       string;
    };

    const validStatuses = new Set(['pending_review', 'verified', 'approved', 'rejected', 'inactive']);

    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!body.area_rai || body.area_rai <= 0) return NextResponse.json({ error: 'area_rai must be > 0' }, { status: 400 });

    const s = createServerSupabaseClient();

    const memberId = body.member_id?.trim() || null;

    if (body.status && !validStatuses.has(body.status)) {
      return NextResponse.json({ error: 'plot status ไม่ถูกต้อง' }, { status: 400 });
    }

    // Verify member exists and is approved when an owner is assigned.
    if (memberId) {
      const { data: member } = await s.from('members')
        .select('id, status, full_name')
        .eq('id', memberId)
        .maybeSingle();

      if (!member) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
      if (member.status !== 'approved') return NextResponse.json({ error: `สมาชิกยังไม่ได้รับอนุมัติ (status: ${member.status})` }, { status: 400 });
    }

    const { data: plot, error } = await s.from('plots').insert({
      member_id:       memberId,
      name:            body.name.trim(),
      area_rai:        body.area_rai,
      lat:             body.lat  ?? null,
      lng:             body.lng  ?? null,
      accuracy:        body.accuracy  ?? null,
      province:        body.province?.trim()     || null,
      district:        body.district?.trim()     || null,
      subdistrict:     body.subdistrict?.trim()  || null,
      village:         body.village?.trim()      || null,
      land_doc_type:   body.land_doc_type        || null,
      land_doc_number: body.land_doc_number?.trim() || null,
      description:     body.description?.trim()  || null,
      status:          body.status ?? 'pending_review',
      created_by:      memberId,
      role_used:       'admin',
      timestamp:       new Date().toISOString(),
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, plot_id: (plot as { id: string }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── PATCH /api/admin/plots ────────────────────────────────────────────────────
// Admin edits any field on any plot
export async function PATCH(request: Request) {
  const actor = await requirePlotAdminOrFieldStaff(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      plot_id:          string;
      name?:            string;
      area_rai?:        number;
      lat?:             number | null;
      lng?:             number | null;
      accuracy?:        number | null;
      province?:        string | null;
      district?:        string | null;
      subdistrict?:     string | null;
      village?:         string | null;
      land_doc_type?:   string | null;
      land_doc_number?: string | null;
      description?:     string | null;
      status?:          string;
      member_id?:       string | null;
      boundary_geojson?:    object | null;
      area_rai_calculated?: number | null;
    };

    if (!body.plot_id) return NextResponse.json({ error: 'plot_id required' }, { status: 400 });

    const validStatuses = new Set(['pending_review', 'verified', 'approved', 'rejected', 'inactive']);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'ชื่อแปลงต้องไม่ว่าง' }, { status: 400 });
      patch.name = body.name.trim();
    }
    if (body.area_rai !== undefined) {
      if (body.area_rai <= 0) return NextResponse.json({ error: 'area_rai must be > 0' }, { status: 400 });
      patch.area_rai = body.area_rai;
    }
    if (body.lat          !== undefined) patch.lat          = body.lat;
    if (body.lng          !== undefined) patch.lng          = body.lng;
    if (body.accuracy     !== undefined) patch.accuracy     = body.accuracy;
    if (body.province     !== undefined) patch.province     = body.province?.trim()     || null;
    if (body.district     !== undefined) patch.district     = body.district?.trim()     || null;
    if (body.subdistrict  !== undefined) patch.subdistrict  = body.subdistrict?.trim()  || null;
    if (body.village      !== undefined) patch.village      = body.village?.trim()      || null;
    if (body.land_doc_type   !== undefined) patch.land_doc_type   = body.land_doc_type   || null;
    if (body.land_doc_number !== undefined) patch.land_doc_number = body.land_doc_number?.trim() || null;
    if (body.description     !== undefined) patch.description     = body.description?.trim()     || null;
    if (body.status !== undefined) {
      if (!validStatuses.has(body.status)) return NextResponse.json({ error: 'plot status ไม่ถูกต้อง' }, { status: 400 });
      patch.status = body.status;
    }
    if (body.member_id !== undefined) {
      const memberId = body.member_id?.trim() || null;
      if (memberId) {
        const { data: member } = await createServerSupabaseClient().from('members')
          .select('id, status')
          .eq('id', memberId)
          .maybeSingle();
        if (!member) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
        if (member.status !== 'approved') return NextResponse.json({ error: `สมาชิกยังไม่ได้รับอนุมัติ (status: ${member.status})` }, { status: 400 });
        patch.assigned_to_member_at = new Date().toISOString();
      }
      patch.member_id = memberId;
    }
    if (body.boundary_geojson    !== undefined) patch.boundary_geojson    = body.boundary_geojson;
    if (body.area_rai_calculated !== undefined) patch.area_rai_calculated = body.area_rai_calculated;

    const s = createServerSupabaseClient();
    const { error } = await s.from('plots').update(patch).eq('id', body.plot_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
