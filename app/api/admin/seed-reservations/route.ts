import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// GET — รายการจองทั้งหมด: รวม seed_reservations + sale_orders (order_type=reservation)
export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const status   = url.searchParams.get('status')    ?? '';
    const memberId = url.searchParams.get('member_id') ?? '';
    const s        = createServerSupabaseClient();

    // ── 1. seed_reservations (เมล็ดพันธุ์จองตรง) ─────────────────────
    let seedQ = s.from('admin_seed_reservations').select('*').limit(200);
    if (status)   seedQ = seedQ.eq('status', status);
    if (memberId) seedQ = seedQ.eq('member_id', memberId);
    const { data: seedRows, error: seedErr } = await seedQ;
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });

    // ── 2. sale_orders (order_type=reservation จาก POS) ──────────────
    let soQ = s.from('sale_orders')
      .select(`
        id, order_number, order_type, status, created_at,
        member_id, note, total, discount, paid_amount, payment_method,
        pickup_slot_id, source_type,
        member:members!sale_orders_member_id_fkey(full_name, phone),
        order_items(product_id, product_name, product_name_snapshot, product_unit, qty, unit_price)
      `)
      .eq('order_type', 'reservation')
      .limit(200);
    if (status)   soQ = soQ.eq('status', status);
    if (memberId) soQ = soQ.eq('member_id', memberId);
    const { data: soRows, error: soErr } = await soQ;
    if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 });

    // ── normalise sale_orders เป็น format เดียวกับ seed_reservations ──
    type SoRow = {
      id: string; order_number: string; status: string; created_at: string;
      member_id: string; note: string | null; total: number; discount: number;
      pickup_slot_id: string | null; source_type: string | null;
      member: { full_name: string; phone: string | null } | null;
      order_items: { product_id: string; product_name: string; product_name_snapshot: string | null; product_unit: string; qty: number; unit_price: number }[];
    };

    const normalised = ((soRows ?? []) as unknown as SoRow[]).map((o) => {
      const m = o.member;
      const firstItem = o.order_items?.[0];
      return {
        id:                   o.id,
        reservation_no:       o.order_number,
        status:               o.status,
        member_id:            o.member_id,
        member_name:          m?.full_name ?? '—',
        member_phone:         m?.phone     ?? null,
        product_id:           firstItem?.product_id ?? null,
        product_name:         firstItem?.product_name ?? firstItem?.product_name_snapshot ?? '—',
        product_unit:         firstItem?.product_unit ?? 'ถุง',
        variety_name:         firstItem?.product_name ?? null,
        variety_name_snapshot: null,
        qty_reserved:         firstItem?.qty ?? 0,
        price_per_bag:        firstItem?.unit_price ?? 0,
        total_amount:         o.total,
        note:                 o.note,
        source_channel:       o.source_type ?? null,
        pickup_date:          null,
        pickup_slot_id:       o.pickup_slot_id,
        created_at:           o.created_at,
        // ไม่มีใน sale_orders
        qty_received: null, qty_sold: null, qty_remaining: null,
        stock_deducted: false, attachment_url: null, attachment_path: null,
        crop_type: null, supplier_name: null, sale_order_id: o.id,
        closed_at: null,
        _source: 'sale_order' as const,
      };
    });

    // รวม + เรียงวันที่ล่าสุด
    const all = [
      ...(seedRows ?? []).map((r) => ({ ...r, _source: 'seed_reservation' as const })),
      ...normalised,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ items: all });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// POST — admin actions
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action:         'confirm' | 'cancel' | 'close_partial' | 'close_full';
      reservation_id: string;
      source:         'seed_reservation' | 'sale_order';
      reason?:        string;
      qty_sold?:      number;
      qty_remaining?: number;
      sale_order_id?: string;
      source_channel?: string;
      attachment_url?: string;
      attachment_path?: string;
    };
    if (!body.action || !body.reservation_id)
      return NextResponse.json({ error: 'action and reservation_id required' }, { status: 400 });

    const s   = createServerSupabaseClient();
    const now = new Date().toISOString();
    const isSO = body.source === 'sale_order';

    // ── confirm ───────────────────────────────────────────────────────
    if (body.action === 'confirm') {
      if (isSO) {
        const { error } = await s.from('sale_orders')
          .update({ status: 'confirmed', updated_at: now } as Record<string, unknown>)
          .eq('id', body.reservation_id).eq('status', 'pending');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const patch: Record<string, unknown> = { status: 'confirmed', updated_at: now };
        if (body.source_channel)  patch.source_channel  = body.source_channel;
        if (body.attachment_url)  patch.attachment_url  = body.attachment_url;
        if (body.attachment_path) patch.attachment_path = body.attachment_path;
        const { error } = await s.from('seed_reservations').update(patch).eq('id', body.reservation_id).eq('status', 'pending');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── cancel ────────────────────────────────────────────────────────
    if (body.action === 'cancel') {
      if (isSO) {
        const { error } = await s.from('sale_orders')
          .update({ status: 'cancelled', updated_at: now } as Record<string, unknown>)
          .eq('id', body.reservation_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await s.rpc('cancel_reservation', { p_reservation_id: body.reservation_id, p_reason: body.reason ?? null });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── close_partial / close_full (seed_reservations only) ──────────
    if (body.action === 'close_partial') {
      const { error } = await s.from('seed_reservations').update({ status: 'partial', qty_sold: body.qty_sold ?? null, qty_remaining: body.qty_remaining ?? null, sale_order_id: body.sale_order_id ?? null, updated_at: now }).eq('id', body.reservation_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'close_full') {
      const table = isSO ? 'sale_orders' : 'seed_reservations';
      const patch = isSO
        ? { status: 'completed', updated_at: now }
        : { status: 'converted', qty_sold: body.qty_sold ?? null, sale_order_id: body.sale_order_id ?? null, closed_at: now, updated_at: now };
      const { error } = await s.from(table as 'sale_orders').update(patch as Record<string,unknown>).eq('id', body.reservation_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
