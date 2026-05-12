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
    const vehiclesJson = form.get('vehicles') as string;

    if (!idToken || !fullName || !citizenIdMasked || !vehiclesJson) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const lineUserId = await verifyLine(idToken);
    const supabase = createServerSupabaseClient();

    // สมัคร truck_owner
    const { data: memberId, error: regError } = await supabase.rpc('submit_truck_registration', {
      p_line_user_id: lineUserId,
      p_full_name: fullName,
      p_phone: phone,
      p_citizen_id_masked: citizenIdMasked,
      p_address: address,
    });

    if (regError || !memberId) {
      return NextResponse.json({ error: regError?.message ?? 'สมัครไม่สำเร็จ' }, { status: 500 });
    }

    // เพิ่มรถ
    const vehicles = JSON.parse(vehiclesJson) as Array<Record<string, unknown>>;

    for (const v of vehicles) {
      if (!v.vehicleType || !v.plateNumber) continue;
      await supabase.rpc('add_registration_vehicle', {
        p_member_id: memberId,
        p_vehicle_type: v.vehicleType,
        p_plate_number: v.plateNumber,
        p_brand: v.brand ?? null,
        p_model: v.model ?? null,
        p_year_be: v.yearBe ?? null,
        p_province: v.province ?? null,
        p_capacity_ton: v.capacityTon ?? null,
        p_note: null,
      });
    }

    // Upload รูปรถ
    for (let i = 0; i < vehicles.length; i++) {
      const photoFile = form.get(`vehiclePhoto_${i}`);
      if (photoFile instanceof File && photoFile.size > 0) {
        const path = `${memberId}/vehicles/vehicle_${i}_${Date.now()}.${photoFile.name.split('.').pop()}`;
        await supabase.storage.from('member-photos').upload(path, photoFile, { upsert: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[REGISTER_TRUCK]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
