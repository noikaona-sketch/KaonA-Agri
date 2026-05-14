import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      harvest_booking_id: string;
      provider_member_id: string;
      rated_by_member_id: string;
      score_punctuality: number; score_quality: number;
      score_loss: number; score_cleanliness: number; score_safety: number;
      note?: string | null;
    };

    const required = ['provider_member_id','rated_by_member_id',
      'score_punctuality','score_quality','score_loss','score_cleanliness','score_safety'];
    for (const k of required) {
      if (!body[k as keyof typeof body]) return NextResponse.json({ error: `ต้องการ ${k}` }, { status: 400 });
    }
    for (const k of ['score_punctuality','score_quality','score_loss','score_cleanliness','score_safety']) {
      const v = body[k as keyof typeof body] as number;
      if (v < 1 || v > 5) return NextResponse.json({ error: `${k} ต้องอยู่ระหว่าง 1-5` }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    // ตรวจว่าเคยให้คะแนนงานนี้แล้วไหม
    if (body.harvest_booking_id) {
      const { data: existing } = await s.from('service_provider_ratings')
        .select('id').eq('harvest_booking_id', body.harvest_booking_id)
        .eq('rated_by_member_id', body.rated_by_member_id).maybeSingle();
      if (existing) return NextResponse.json({ error: 'ให้คะแนนงานนี้ไปแล้ว' }, { status: 409 });
    }

    const { error } = await s.from('service_provider_ratings').insert({
      harvest_booking_id:  body.harvest_booking_id ?? null,
      provider_member_id:  body.provider_member_id,
      rated_by_member_id:  body.rated_by_member_id,
      score_punctuality:   body.score_punctuality,
      score_quality:       body.score_quality,
      score_loss:          body.score_loss,
      score_cleanliness:   body.score_cleanliness,
      score_safety:        body.score_safety,
      note: body.note ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
