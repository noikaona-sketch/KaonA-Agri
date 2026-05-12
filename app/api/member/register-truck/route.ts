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

type VehiclePayload = {
  vehicleType: string; plateNumber: string;
  brand: string | null; model: string | null;
  yearBe: number | null; province: string | null; capacityTon: number | null;
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const idToken = form.get('idToken') as string;
    const fullName = form.get('fullName') as string;
    const phone = form.get('phone') as string;
    const citizenIdMasked = form.get('citizenIdMasked') as string;
    const address = (form.get('address') as string) || null;
    const vehiclesJson = (form.get('vehicles') as string) || '[]';

    if (!idToken || !fullName || !citizenIdMasked) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const lineUserId = await verifyLine(idToken);
    const supabase = createServerSupabaseClient();

    const { data: member, error: findErr } = await supabase
      .from('members').select('id').eq('line_user_id', lineUserId).maybeSingle();

    if (findErr || !member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก กรุณาเปิดแอปใหม่' }, { status: 404 });
    }

    // อัปเดตข้อมูลสมาชิก
    const { error: updateErr } = await supabase.from('members').update({
      full_name: fullName, phone, citizen_id_masked: citizenIdMasked,
      address, status: 'pending', registration_type: 'self', updated_at: new Date().toISOString(),
    }).eq('id', member.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // ตั้ง role truck_owner
    await supabase.from('member_roles').upsert(
      { member_id: member.id, role: 'truck_owner', is_primary: true },
      { onConflict: 'member_id,role' }
    );

    // สร้าง approval
    await supabase.from('approvals').insert({
      member_id: member.id, requested_by: member.id,
      resource_type: 'member', resource_id: member.id,
      status: 'pending', note: 'Truck owner registration',
    }).then(() => {});

    // เพิ่มรถ (direct insert)
    const vehicles = JSON.parse(vehiclesJson) as VehiclePayload[];
    for (const v of vehicles) {
      if (!v.vehicleType || !v.plateNumber) continue;
      await supabase.from('member_vehicles').insert({
        member_id: member.id, vehicle_type: v.vehicleType,
        plate_number: v.plateNumber.toUpperCase(), brand: v.brand,
        model: v.model, year_be: v.yearBe, province: v.province,
        capacity_ton: v.capacityTon,
      });
    }

    // Upload รูปรถ
    for (let i = 0; i < vehicles.length; i++) {
      const photo = form.get(`vehiclePhoto_${i}`);
      if (photo instanceof File && photo.size > 0) {
        const ext = photo.name.split('.').pop() ?? 'jpg';
        await supabase.storage.from('member-photos')
          .upload(`${member.id}/vehicles/vehicle_${i}_${Date.now()}.${ext}`, photo, { upsert: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[REGISTER_TRUCK]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
