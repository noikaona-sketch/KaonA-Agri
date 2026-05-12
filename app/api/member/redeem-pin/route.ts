import { NextResponse } from 'next/server';

import { createServerSupabaseClient, getLineChannelId } from '../../auth/line/line-auth-helpers';

type RedeemPinPayload = {
  idToken?: string;
  pin?: string;
};

async function verifyLineUserId(idToken: string): Promise<string> {
  const channelId = getLineChannelId();
  if (!channelId) throw new Error('LINE channel id is not configured');

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
    const body = (await request.json()) as RedeemPinPayload;

    if (!body.idToken || !body.pin) {
      return NextResponse.json({ error: 'idToken และ pin จำเป็นต้องระบุ' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(body.pin)) {
      return NextResponse.json({ error: 'PIN ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
    }

    const lineUserId = await verifyLineUserId(body.idToken);
    const supabase = createServerSupabaseClient();

    // หา member จาก line_user_id (service role bypass RLS)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, auth_user_id, status')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก กรุณาเปิดแอปใหม่' }, { status: 404 });
    }

    // ตรวจ PIN ตรงกับ member ไหน + ยังไม่หมดอายุ + ยังไม่ถูกใช้
    const { data: pinOwner, error: pinError } = await supabase
      .from('members')
      .select('id, invite_role')
      .eq('invite_pin', body.pin)
      .gt('invite_pin_expires', new Date().toISOString())
      .is('invite_pin_used_at', null)
      .maybeSingle();

    if (pinError || !pinOwner) {
      return NextResponse.json({ error: 'PIN ไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
    }

    // mark PIN ว่าใช้แล้ว
    await supabase
      .from('members')
      .update({ invite_pin_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', pinOwner.id);

    // เพิ่ม role ให้ caller + approve ทันที
    await supabase
      .from('member_roles')
      .upsert({ member_id: member.id, role: pinOwner.invite_role, is_primary: false }, { onConflict: 'member_id,role' });

    await supabase
      .from('members')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', member.id);

    return NextResponse.json({ ok: true, role: pinOwner.invite_role });
  } catch (error) {
    console.error('[REDEEM_PIN_ROUTE]', error);
    return NextResponse.json({ error: 'ไม่สามารถใช้ PIN ได้ กรุณาลองใหม่' }, { status: 500 });
  }
}
