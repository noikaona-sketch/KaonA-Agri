import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

type CreateProviderRequestBody = {
  memberId?: string;
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('provider_requests')
      .select('*')
      .eq('member_id', memberId)
      .eq('request_type', 'service_team')
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
    const body = (await request.json()) as CreateProviderRequestBody;
    if (!body.memberId || !body.title || !body.requesterName || !body.phone || !body.area || !body.providerTeamName || !body.equipmentSummary) {
      return NextResponse.json({ error: 'required fields missing' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { data, error } = await s.from('provider_requests').insert({
      member_id: body.memberId,
      request_type: 'service_team',
      title: body.title,
      requester_name: body.requesterName,
      phone: body.phone,
      area: body.area,
      note: body.note ?? null,
      service_type: body.serviceType ?? null,
      provider_team_name: body.providerTeamName,
      equipment_summary: body.equipmentSummary,
      availability_note: body.availabilityNote ?? null,
      status: 'pending',
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
