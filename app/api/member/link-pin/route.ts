import { NextResponse } from 'next/server';

import { createServerSupabaseClient, getLineChannelId } from '../../auth/line/line-auth-helpers';

type LinkPinPayload = {
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
    const body = (await request.json()) as LinkPinPayload;

    if (!body.idToken || !body.pin) {
      return NextResponse.json({ error: 'idToken และ pin จำเป็นต้องระบุ' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(body.pin)) {
      return NextResponse.json({ error: 'PIN ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
    }

    const lineUserId = await verifyLineUserId(body.idToken);
    const supabase = createServerSupabaseClient();

    // ตรวจ PIN — ต้องเป็น admin_created + ยังไม่มี line_user_id
    const { data: pinRecord } = await supabase
      .from('members')
      .select('id, invite_role, registration_type, line_user_id')
      .eq('invite_pin', body.pin)
      .gt('invite_pin_expires', new Date().toISOString())
      .is('invite_pin_used_at', null)
      .maybeSingle();

    if (!pinRecord) {
      return NextResponse.json({ error: 'PIN ไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
    }

    if (pinRecord.registration_type !== 'admin_created' || pinRecord.line_user_id !== null) {
      return NextResponse.json({ error: 'PIN นี้ไม่สามารถใช้กับการลงทะเบียนประเภทนี้ได้' }, { status: 400 });
    }

    // ตรวจว่า LINE นี้ยังไม่มี member อยู่แล้ว
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'LINE นี้มีบัญชีอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่' }, { status: 409 });
    }

    // ผูก line_user_id + mark PIN ว่าใช้แล้ว + approve
    const { error: updateError } = await supabase
      .from('members')
      .update({
        line_user_id: lineUserId,
        invite_pin_used_at: new Date().toISOString(),
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pinRecord.id);

    if (updateError) {
      return NextResponse.json({ error: 'ไม่สามารถผูกบัญชีได้ กรุณาลองใหม่' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, role: pinRecord.invite_role });
  } catch (error) {
    console.error('[LINK_PIN_ROUTE]', error);
    return NextResponse.json({ error: 'ไม่สามารถใช้ PIN ได้ กรุณาลองใหม่' }, { status: 500 });
  }
}
