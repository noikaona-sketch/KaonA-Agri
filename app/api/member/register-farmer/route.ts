import { NextResponse } from 'next/server';

import { createServerSupabaseClient, getLineChannelId } from '../../auth/line/line-auth-helpers';

async function verifyLine(idToken: string) {
  const channelId = getLineChannelId();
  if (!channelId) throw new Error('LINE channel id not configured');
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) throw new Error('LINE token verification failed');
  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error('LINE user id missing');
  return data.sub;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const idToken = form.get('idToken') as string;
    const fullName = form.get('fullName') as string;
    const phone = form.get('phone') as string;
    const citizenIdMasked = form.get('citizenIdMasked') as string;
    const address = (form.get('address') as string) || null;
    const plotsJson = form.get('plots') as string;

    if (!idToken || !fullName || !citizenIdMasked) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const lineUserId = await verifyLine(idToken);
    const supabase = createServerSupabaseClient();

    // สมัครสมาชิก
    const { data: memberId, error: regError } = await supabase.rpc('submit_farmer_registration', {
      p_line_user_id: lineUserId,
      p_full_name: fullName,
      p_phone: phone,
      p_citizen_id_masked: citizenIdMasked,
      p_address: address,
    });

    if (regError || !memberId) {
      return NextResponse.json({ error: regError?.message ?? 'สมัครสมาชิกไม่สำเร็จ' }, { status: 500 });
    }

    // เพิ่มแปลง
    const plots = plotsJson ? (JSON.parse(plotsJson) as Array<Record<string, unknown>>) : [];

    for (const plot of plots) {
      if (!plot.name || !plot.areaRai || plot.lat == null || plot.lng == null) continue;
      await supabase.rpc('add_registration_plot', {
        p_member_id: memberId,
        p_name: plot.name,
        p_area_rai: plot.areaRai,
        p_lat: plot.lat,
        p_lng: plot.lng,
        p_accuracy: plot.accuracy ?? null,
        p_land_doc_type: plot.landDocType ?? null,
        p_land_doc_number: plot.landDocNumber ?? null,
        p_province: plot.province ?? null,
        p_description: null,
      });
    }

    // Upload รูปแปลง (ถ้ามี)
    for (let i = 0; i < plots.length; i++) {
      const photoFile = form.get(`plotPhoto_${i}`);
      if (photoFile instanceof File && photoFile.size > 0) {
        const path = `${memberId}/plots/plot_${i}_${Date.now()}.${photoFile.name.split('.').pop()}`;
        await supabase.storage.from('member-photos').upload(path, photoFile, { upsert: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[REGISTER_FARMER]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
