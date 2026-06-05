import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

const PHOTO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const CONTEXT_TH: Record<string, string> = {
  general:       'ดูทั่วไป',
  watering:      'กำลังรดน้ำ',
  fertilizing:   'ใส่ปุ๋ย',
  pest_found:    'เจอแมลง/ศัตรูพืช',
  growth_check:  'เช็กการเจริญเติบโต',
};

const GROWTH_STAGE: Record<string, { th: string; daysMin: number; daysMax: number }> = {
  germination: { th: 'งอก',            daysMin: 0,   daysMax: 7   },
  seedling:    { th: 'ต้นกล้า',        daysMin: 7,   daysMax: 21  },
  vegetative:  { th: 'เจริญเติบโต',    daysMin: 21,  daysMax: 45  },
  tasseling:   { th: 'ออกดอกตัวผู้',   daysMin: 45,  daysMax: 55  },
  silking:     { th: 'ออกไหม',         daysMin: 55,  daysMax: 65  },
  grain_fill:  { th: 'เมล็ดพัฒนา',     daysMin: 65,  daysMax: 90  },
  maturity:    { th: 'แก่/สุก',        daysMin: 90,  daysMax: 110 },
  harvest_ready:{ th: 'พร้อมเก็บเกี่ยว', daysMin: 110, daysMax: 999 },
};

function getExpectedStage(ageDays: number): string {
  for (const [key, val] of Object.entries(GROWTH_STAGE)) {
    if (ageDays >= val.daysMin && ageDays < val.daysMax) return `${val.th} (${key})`;
  }
  return 'ไม่ทราบระยะ';
}

// POST /api/member/crop-photo-analysis
// multipart/form-data:
//   photo           (File, required)
//   planting_cycle_id (optional)
//   plot_id         (optional)
//   activity_context  (optional: general|watering|fertilizing|pest_found|growth_check)
export async function POST(request: Request) {
  const s      = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'ต้องส่งข้อมูลแบบ multipart/form-data' }, { status: 400 }); }

  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0)
    return NextResponse.json({ error: 'กรุณาแนบรูปภาพ' }, { status: 400 });

  const cycleId  = (form.get('planting_cycle_id') as string | null) || null;
  const plotId   = (form.get('plot_id')           as string | null) || null;
  const context  = (form.get('activity_context')  as string | null) || 'general';

  // ── Get cycle info for context ─────────────────────────────────────────────
  let cropName = 'ข้าวโพด';
  let ageDays: number | null = null;
  let plantedAt: string | null = null;
  let expectedStage = '';

  if (cycleId) {
    const { data: cycle } = await s.from('planting_cycles')
      .select('crop_name, planted_at')
      .eq('id', cycleId).maybeSingle();
    if (cycle) {
      cropName  = cycle.crop_name;
      plantedAt = cycle.planted_at;
      if (cycle.planted_at) {
        const ms = Date.now() - new Date(cycle.planted_at).getTime();
        ageDays  = Math.floor(ms / 86400000);
        expectedStage = getExpectedStage(ageDays);
      }
    }
  }

  // ── Upload photo ───────────────────────────────────────────────────────────
  const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `crop-analysis/${caller.memberId}/${Date.now()}.${ext}`;
  const { error: upErr } = await s.storage
    .from(PHOTO_BUCKET).upload(path, photo, { upsert: false });
  if (upErr) return NextResponse.json({ error: `อัปโหลดรูปไม่สำเร็จ: ${upErr.message}` }, { status: 500 });

  const { data: urlData } = s.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // ── Call Claude vision ────────────────────────────────────────────────────
  const contextLabel = CONTEXT_TH[context] ?? 'ดูทั่วไป';
  const ageText = ageDays !== null
    ? `อายุ ${ageDays} วัน (คาดว่าอยู่ในระยะ${expectedStage})`
    : '';

  const prompt = `คุณเป็นเพื่อนบ้านที่ปลูกข้าวโพดมานาน พูดแบบคนบ้านๆ อ่านง่าย อบอุ่น ไม่เป็นทางการ

ข้อมูลรอบปลูก:
- พืช: ${cropName}
- ${ageText}
- กิจกรรมที่กำลังทำ: ${contextLabel}

ดูรูปนี้แล้วบอกหน่อยนะ:
1. **ชมก่อนเลย** (ถ้าต้นดูดีให้ชมจริงๆ อย่าชมเกินจริง)
2. **สังเกตเห็นอะไร** บอกสั้นๆ ว่าต้นอยู่ในระยะไหน สมบูรณ์ไหม
3. **แนะนำ** สิ่งที่ควรระวัง หรือทำต่อไป (1-2 ประโยคพอ)
4. **ถ้าเจอปัญหา** เช่น ใบเหลือง หนอน โรค ให้บอกตรงๆ แต่ไม่ต้องตกใจ

ตอบเป็นภาษาไทยบ้านๆ 3-5 ประโยค ห้ามใช้ศัพท์วิชาการ
สรุป 1 บรรทัดแรก (ไม่เกิน 20 คำ) ว่า "ดีมาก" / "ดี" / "ระวังหน่อย" / "ต้องแก้ด่วน"`;

  let aiFullResponse = '';
  let aiGrade = 'good';
  let aiSummary = '';

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!anthropicKey) {
      console.error('[CROP_ANALYSIS] ANTHROPIC_API_KEY not set');
    }
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: publicUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const aiData = (await aiRes.json()) as { content?: { type: string; text: string }[] };
    aiFullResponse = aiData.content?.find(b => b.type === 'text')?.text ?? '';

    // Parse grade from first line
    const firstLine = aiFullResponse.split('\n')[0].toLowerCase();
    if (firstLine.includes('ดีมาก') || firstLine.includes('สวยมาก') || firstLine.includes('เยี่ยม')) {
      aiGrade = 'great';
    } else if (firstLine.includes('ระวัง') || firstLine.includes('เฝ้าดู')) {
      aiGrade = 'warning';
    } else if (firstLine.includes('ด่วน') || firstLine.includes('แก้') || firstLine.includes('เสีย') || firstLine.includes('โรค')) {
      aiGrade = 'alert';
    } else {
      aiGrade = 'good';
    }

    // Summary = first sentence
    aiSummary = aiFullResponse.split(/[.!?\n]/)[0].trim().slice(0, 80);

  } catch (aiErr) {
    console.error('[CROP_ANALYSIS] AI error:', aiErr);
    aiFullResponse = 'วิเคราะห์ไม่สำเร็จในขณะนี้';
    aiGrade = 'good';
    aiSummary = 'ถ่ายรูปไว้แล้ว';
  }

  // ── Save to DB ─────────────────────────────────────────────────────────────
  const { data: saved, error: saveErr } = await s.from('crop_photo_analyses').insert({
    member_id:         caller.memberId,
    planting_cycle_id: cycleId,
    plot_id:           plotId,
    storage_path:      path,
    activity_context:  context,
    crop_name:         cropName,
    age_days:          ageDays,
    planted_at:        plantedAt,
    ai_grade:          aiGrade,
    ai_summary:        aiSummary,
    ai_full_response:  aiFullResponse,
  }).select('id').single();

  if (saveErr) console.error('[CROP_ANALYSIS] save error:', saveErr.message);

  return NextResponse.json({
    ok:               true,
    analysis_id:      (saved as { id: string } | null)?.id ?? null,
    ai_grade:         aiGrade,
    ai_summary:       aiSummary,
    ai_full_response: aiFullResponse,
    storage_path:     path,
    public_url:       publicUrl,
    age_days:         ageDays,
    expected_stage:   expectedStage,
  }, { status: 201 });
}

// GET /api/member/crop-photo-analysis?planting_cycle_id=xxx&limit=10
export async function GET(request: Request) {
  const s      = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  const url     = new URL(request.url);
  const cycleId = url.searchParams.get('planting_cycle_id') ?? '';
  const plotId  = url.searchParams.get('plot_id') ?? '';
  const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);

  let q = s.from('crop_photo_analyses')
    .select('id, storage_path, activity_context, age_days, ai_grade, ai_summary, analyzed_at')
    .eq('member_id', caller.memberId)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  if (cycleId) q = q.eq('planting_cycle_id', cycleId);
  else if (plotId) q = q.eq('plot_id', plotId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ analyses: data ?? [] });
}



