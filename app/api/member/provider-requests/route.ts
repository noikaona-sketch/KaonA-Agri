import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

type ProviderRequestType = 'service_team' | 'field_team';

function normalizeRequestType(value: unknown): ProviderRequestType {
  return value === 'field_team' ? 'field_team' : 'service_team';
}

type CreateProviderRequestBody = {
  requestType?: ProviderRequestType;
  title?: string;
  requesterName?: string;
  phone?: string;
  area?: string;
  note?: string;
  serviceType?: string;
  providerTeamName?: string;
  equipmentSummary?: string;
  availabilityNote?: string;
};

async function resolveMemberIdFromAuth(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;

  const s = createServerSupabaseClient();
  const { data: userData, error: userErr } = await s.auth.getUser(token);
  if (userErr || !userData.user) return null;
  const { data: member } = await s
    .from('members')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  return member?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const memberId = await resolveMemberIdFromAuth(request);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const url = new URL(request.url);
    const requestType = normalizeRequestType(url.searchParams.get('requestType'));

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('provider_requests')
      .select('*')
      .eq('member_id', memberId)
      .eq('request_type', requestType)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const memberId = await resolveMemberIdFromAuth(request);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const body = (await request.json()) as CreateProviderRequestBody;
    const requestType = normalizeRequestType(body.requestType);
    const requiresProviderProfile = requestType === 'service_team';
    if (!body.title || !body.requesterName || !body.phone || !body.area || (requiresProviderProfile && (!body.providerTeamName || !body.equipmentSummary))) {
      return NextResponse.json({ error: 'required fields missing' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { data, error } = await s.from('provider_requests').insert({
      member_id: memberId,
      request_type: requestType,
      title: body.title,
      requester_name: body.requesterName,
      phone: body.phone,
      area: body.area,
      note: body.note ?? null,
      service_type: requestType === 'service_team' ? (body.serviceType ?? null) : null,
      provider_team_name: requestType === 'service_team' ? (body.providerTeamName ?? null) : null,
      equipment_summary: requestType === 'service_team' ? (body.equipmentSummary ?? null) : null,
      availability_note: requestType === 'service_team' ? (body.availabilityNote ?? null) : null,
      status: 'pending',
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
