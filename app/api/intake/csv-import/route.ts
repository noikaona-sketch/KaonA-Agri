import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../admin/members/_admin-auth';
import { resolveMemberId, findOrCreateBooking } from '@/lib/intake/find-booking';
import { calculateIntake }            from '@/lib/intake/calculate-intake';
import { sendIntakeReceipt }          from '@/lib/intake/send-intake-receipt';

export const dynamic = 'force-dynamic';

type CsvRow = {
  scale_ticket_no : string;
  member_phone    : string;
  gross_weight_kg : number;
  moisture_pct    : number;
  weigh_at        : string;
  location_name   : string;
  quality_grade?  : 'A' | 'B' | 'C' | 'reject';
};

type ErrorRow = {
  row: number; scale_ticket_no: string;
  reason: 'member_not_found' | 'duplicate_ticket' | 'invalid_moisture' | 'missing_field' | 'location_not_found';
  detail: string;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return {
      scale_ticket_no: obj['scale_ticket_no'] ?? '',
      member_phone:    obj['member_phone']    ?? '',
      gross_weight_kg: Number(obj['gross_weight_kg'] || 0),
      moisture_pct:    Number(obj['moisture_pct']    || 0),
      weigh_at:        obj['weigh_at']  ?? new Date().toISOString(),
      location_name:   obj['location_name'] ?? '',
      quality_grade:   (obj['quality_grade'] as CsvRow['quality_grade']) || undefined,
    };
  });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('service.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const url    = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'preview'; // preview | commit

    const body   = await request.json() as { csv?: string; location_id?: string; rows?: CsvRow[] };
    const s      = createServerSupabaseClient();

    // ── PREVIEW ──────────────────────────────────────────────────────────────
    if (action === 'preview') {
      if (!body.csv || !body.location_id)
        return NextResponse.json({ error: 'csv และ location_id จำเป็น' }, { status: 400 });

      const rows   = parseCsv(body.csv);
      const valid: (CsvRow & { member_id: string })[] = [];
      const errors: ErrorRow[] = [];

      // ตรวจ duplicate ticket ภายใน CSV ก่อน
      const seen = new Set<string>();
      for (const [i, row] of rows.entries()) {
        const rowNo = i + 2;
        if (!row.scale_ticket_no || !row.member_phone || !row.gross_weight_kg) {
          errors.push({ row: rowNo, scale_ticket_no: row.scale_ticket_no, reason: 'missing_field', detail: 'ข้อมูลไม่ครบ' }); continue;
        }
        if (row.moisture_pct < 8 || row.moisture_pct > 45) {
          errors.push({ row: rowNo, scale_ticket_no: row.scale_ticket_no, reason: 'invalid_moisture', detail: `ความชื้น ${row.moisture_pct}% ผิดช่วง 8–45%` }); continue;
        }
        if (seen.has(row.scale_ticket_no)) {
          errors.push({ row: rowNo, scale_ticket_no: row.scale_ticket_no, reason: 'duplicate_ticket', detail: 'เลขบัตรซ้ำใน CSV' }); continue;
        }
        seen.add(row.scale_ticket_no);

        // ตรวจ duplicate ใน DB
        const { data: dup } = await s.from('intake_transactions').select('id').eq('scale_ticket_no', row.scale_ticket_no).maybeSingle();
        if (dup) { errors.push({ row: rowNo, scale_ticket_no: row.scale_ticket_no, reason: 'duplicate_ticket', detail: 'เลขบัตรนี้รับซื้อแล้ว' }); continue; }

        // resolve member
        const memberId = await resolveMemberId(row.member_phone, s);
        if (!memberId) { errors.push({ row: rowNo, scale_ticket_no: row.scale_ticket_no, reason: 'member_not_found', detail: `ไม่พบเบอร์ ${row.member_phone}` }); continue; }

        valid.push({ ...row, member_id: memberId });
      }

      return NextResponse.json({ ok: true, valid, errors, location_id: body.location_id });
    }

    // ── COMMIT ────────────────────────────────────────────────────────────────
    if (!body.rows?.length || !body.location_id)
      return NextResponse.json({ error: 'rows และ location_id จำเป็น' }, { status: 400 });

    let successCount = 0;
    const commitErrors: { scale_ticket_no: string; error: string }[] = [];

    for (const row of body.rows as (CsvRow & { member_id: string })[]) {
      try {
        const weighAt  = new Date(row.weigh_at);
        const booking  = await findOrCreateBooking(row.member_id, body.location_id, weighAt, s);
        if (!booking.found) { commitErrors.push({ scale_ticket_no: row.scale_ticket_no, error: booking.error }); continue; }

        const result = await calculateIntake({ gross_weight_kg: row.gross_weight_kg, moisture_pct: row.moisture_pct, member_id: row.member_id, location_id: body.location_id, weigh_at: weighAt }, s);

        await s.from('intake_transactions').insert({
          harvest_booking_id: booking.booking.id,
          member_id:          row.member_id,
          location_id:        body.location_id,
          scale_ticket_no:    row.scale_ticket_no,
          gross_weight_kg:    row.gross_weight_kg,
          moisture_pct:       row.moisture_pct,
          deduct_pct:         result.deduct_pct,
          deduct_kg:          result.deduct_kg,
          net_weight_kg:      result.net_weight_kg,
          price_per_kg:       result.price_per_kg,
          gross_amount:       result.gross_amount,
          net_amount:         result.net_amount,
          quality_grade:      row.quality_grade ?? null,
          weigh_at:           row.weigh_at,
          import_source:      'csv',
        });

        successCount++;
        // LINE push — fail silently
        const { data: m } = await s.from('members').select('line_uid,line_user_id').eq('id', row.member_id).maybeSingle();
        const lineId = m?.line_uid ?? m?.line_user_id;
        if (lineId) void sendIntakeReceipt({ lineUid: lineId, result, bookingId: booking.booking.id, scaleTicketNo: row.scale_ticket_no, locationName: row.location_name }).catch(() => {});
      } catch (e) { commitErrors.push({ scale_ticket_no: row.scale_ticket_no, error: String(e) }); }
    }

    return NextResponse.json({ ok: true, successCount, errors: commitErrors });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
