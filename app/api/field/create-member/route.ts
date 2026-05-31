import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const FIELD_ROLES = ['staff', 'admin', 'inspector', 'leader'];

async function resolveFieldStaff(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Try Supabase JWT (LIFF session)
  const { createAnonSupabaseClient } = await import('../../auth/line/line-auth-helpers');
  const anon = createAnonSupabaseClient();
  const { data: { user } } = await anon.auth.getUser(token);

  let memberId: string | null = null;

  if (user?.id) {
    const { data: m } = await s
      .from('members')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    memberId = m?.id ?? null;
  } else {
    // Fallback: session token table
    const { data: session } = await s
      .from('sessions')
      .select('member_id')
      .eq('token', token)
      .maybeSingle();
    memberId = session?.member_id ?? null;
  }

  if (!memberId) return null;

  const { data: role } = await s
    .from('member_roles')
    .select('role')
    .eq('member_id', memberId)
    .in('role', FIELD_ROLES)
    .limit(1)
    .maybeSingle();

  return role ? memberId : null;
}

type CreateMemberPayload = {
  full_name: string;
  phone?: string;
  citizen_id?: string;
  address?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  plot?: {
    name: string;
    area_rai: number;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    province?: string;
    description?: string;
  };
  pin_hours?: number;
};

export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const staffId = await resolveFieldStaff(request, s);
    if (!staffId) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ — ต้องเป็นเจ้าหน้าที่ภาคสนาม' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as CreateMemberPayload;

    if (!body.full_name?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ-นามสกุล' }, { status: 400 });
    }

    // Mask citizen ID if provided
    let citizenIdMasked = 'PENDING';
    if (body.citizen_id) {
      const digits = body.citizen_id.replace(/\D/g, '');
      if (digits.length !== 13) {
        return NextResponse.json({ error: 'เลขบัตรประชาชนต้องมี 13 หลัก' }, { status: 400 });
      }
      citizenIdMasked = `***${digits.slice(-4)}`;
    }

    // Use RPC to create member + PIN (reuses existing admin function — staff has permission)
    const hours = body.pin_hours ?? 168; // 7 days default for field-assisted
    const { data, error: rpcErr } = await s.rpc('admin_create_member_with_pin', {
      p_full_name: body.full_name.trim(),
      p_phone: body.phone?.trim() ?? null,
      p_citizen_id_masked: citizenIdMasked,
      p_role: 'farmer',
      p_hours: hours,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const result = data as { member_id: string; pin: string; role: string };

    // Update address fields (not in RPC)
    if (body.address || body.province || body.district || body.subdistrict) {
      await s
        .from('members')
        .update({
          address: body.address?.trim() || null,
          province: body.province || null,
          district: body.district || null,
          subdistrict: body.subdistrict || null,
        })
        .eq('id', result.member_id);
    }

    // Add plot if provided
    if (body.plot?.name?.trim() && Number(body.plot.area_rai) > 0) {
      await s.from('plots').insert({
        member_id: result.member_id,
        name: body.plot.name.trim(),
        area_rai: Number(body.plot.area_rai),
        lat: body.plot.lat ?? null,
        lng: body.plot.lng ?? null,
        accuracy: body.plot.accuracy ?? null,
        province: body.plot.province?.trim() || null,
        description: body.plot.description?.trim() || null,
        status: 'pending_review',
        role_used: 'staff',
        timestamp: new Date().toISOString(),
      });
    }

    // Create approval record (optional — status already 'pending' from RPC)
    await s.from('approvals').insert({
      member_id: result.member_id,
      requested_by: staffId,
      resource_type: 'member',
      resource_id: result.member_id,
      status: 'pending',
      note: 'ลงทะเบียนโดยเจ้าหน้าที่ภาคสนาม',
    }).then(() => {}); // ignore conflict

    return NextResponse.json({
      ok: true,
      member_id: result.member_id,
      pin: result.pin,
    });
  } catch (e) {
    console.error('[FIELD_CREATE_MEMBER]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
