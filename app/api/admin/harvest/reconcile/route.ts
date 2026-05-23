import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET  ?date=YYYY-MM-DD&location_id=xxx  — summary ของวัน
// POST action=close   — ปิดรับ flagging no-show + lock completed
// POST action=export  — คืน CSV string

export async function GET(request: Request) {
  const _ar = await requireAdminPermission('service.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url        = new URL(request.url);
  const date       = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const locationId = url.searchParams.get('location_id');
  const s          = createServerSupabaseClient();

  let q = s.from('harvest_bookings')
    .select(`id, status, scheduled_date, actual_completed_at, locked_at,
      gross_weight_kg, net_weight_kg, net_amount, actual_moisture_pct, quality_grade,
      estimated_tonnage, intake_source,
      members!harvest_bookings_member_id_fkey(full_name, phone),
      pickup_locations!harvest_bookings_intake_location_id_fkey(name)`)
    .eq('scheduled_date', date)
    .not('status', 'in', '("cancelled")');
  if (locationId) q = q.eq('intake_location_id', locationId);
  const { data, error } = await q.order('status').order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows      = data ?? [];
  const completed = rows.filter(r => r.status === 'completed');
  const pending   = rows.filter(r => ['planned','confirmed'].includes(r.status));
  const rejected  = rows.filter(r => r.status === 'rejected');
  const noShow    = rows.filter(r => r.status === 'no_show');

  const summary = {
    date, total: rows.length,
    completed: completed.length, pending: pending.length,
    rejected: rejected.length,  no_show: noShow.length,
    total_net_weight_kg: completed.reduce((s, r) => s + Number(r.net_weight_kg ?? 0), 0),
    total_net_amount:    completed.reduce((s, r) => s + Number(r.net_amount    ?? 0), 0),
    all_locked:          completed.every(r => r.locked_at),
  };

  return NextResponse.json({ summary, rows });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('service.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const { action, date, location_id } =
      (await request.json()) as { action: 'close' | 'export'; date: string; location_id?: string };
    if (!date) return NextResponse.json({ error: 'date จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ── action: close — ปิดรับวัน ─────────────────────────────────────────
    if (action === 'close') {
      // flag no-show: planned/confirmed ที่ยังไม่ได้มา
      let noShowQ = s.from('harvest_bookings')
        .update({ status: 'no_show' })
        .eq('scheduled_date', date)
        .in('status', ['planned', 'confirmed']);
      if (location_id) noShowQ = noShowQ.eq('intake_location_id', location_id);
      await noShowQ;

      // lock completed bookings
      let lockQ = s.from('harvest_bookings')
        .update({ locked_at: new Date().toISOString() })
        .eq('scheduled_date', date)
        .eq('status', 'completed')
        .is('locked_at', null);
      if (location_id) lockQ = lockQ.eq('intake_location_id', location_id);
      await lockQ;

      return NextResponse.json({ ok: true, action: 'close' });
    }

    // ── action: export — คืน CSV ───────────────────────────────────────────
    if (action === 'export') {
      let q = s.from('harvest_bookings')
        .select(`id, status, scheduled_date, actual_completed_at,
          gross_weight_kg, net_weight_kg, actual_moisture_pct, quality_grade,
          net_amount, price_per_kg, bonus_per_kg, payment_method, scale_ticket_no, intake_source,
          members!harvest_bookings_member_id_fkey(full_name, phone),
          pickup_locations!harvest_bookings_intake_location_id_fkey(name)`)
        .eq('scheduled_date', date)
        .not('status', 'in', '("cancelled")');
      if (location_id) q = q.eq('intake_location_id', location_id);
      const { data } = await q.order('status').order('actual_completed_at');

      type Row = typeof data extends (infer T)[] | null ? T : never;
      const rows = (data ?? []) as Row[];

      const headers = ['ชื่อสมาชิก','เบอร์โทร','จุดรับ','สถานะ','วันเวลารับ','น้ำหนักรวม(กก.)','น้ำหนักสุทธิ(กก.)','ความชื้น(%)','เกรด','ราคา/กก.','โบนัส/กก.','ยอดสุทธิ(บาท)','การชำระ','เลขใบชั่ง','ช่องทาง'];
      const csvRows = rows.map(r => {
        const m = r.members as unknown as { full_name: string; phone: string | null } | null;
        const l = r.pickup_locations as unknown as { name: string } | null;
        return [
          m?.full_name ?? '', m?.phone ?? '', l?.name ?? '',
          r.status, r.actual_completed_at ? new Date(r.actual_completed_at as string).toLocaleString('th-TH') : '',
          r.gross_weight_kg ?? '', r.net_weight_kg ?? '', r.actual_moisture_pct ?? '',
          r.quality_grade ?? '', r.price_per_kg ?? '', r.bonus_per_kg ?? '',
          r.net_amount ?? '', r.payment_method ?? '', r.scale_ticket_no ?? '', r.intake_source ?? '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
      return NextResponse.json({ ok: true, csv, filename: `intake-${date}.csv` });
    }

    return NextResponse.json({ error: 'action ต้องเป็น close หรือ export' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
