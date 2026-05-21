import type { SupabaseClient } from '@supabase/supabase-js';

type SoRow = {
  id: string; order_number: string; status: string; created_at: string;
  member_id: string; note: string | null; total: number;
  pickup_slot_id: string | null; source_type: string | null;
  member: { full_name: string; phone: string | null } | null;
  pickup_slot: { pickup_date: string; pickup_time: string; pickup_locations: { name: string } | null } | null;
  order_items: { product_id: string; product_name: string; product_name_snapshot: string | null; product_unit: string; qty: number; unit_price: number }[];
};

function thDate(d: string, time?: string) {
  const base = new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  return time ? `${base} ${time}` : base;
}

function normaliseSaleOrder(o: SoRow) {
  const item = o.order_items?.[0];
  const slot = o.pickup_slot;
  return {
    id: o.id, reservation_no: o.order_number, status: o.status,
    member_id: o.member_id,
    member_name: o.member?.full_name ?? '—', member_phone: o.member?.phone ?? null,
    product_id: item?.product_id ?? null,
    product_name: item?.product_name ?? item?.product_name_snapshot ?? '—',
    product_unit: item?.product_unit ?? 'ถุง',
    variety_name: item?.product_name ?? null, variety_name_snapshot: null,
    qty_reserved: item?.qty ?? 0, price_per_bag: item?.unit_price ?? 0,
    total_amount: o.total, note: o.note,
    source_channel: o.source_type ?? null,
    pickup_date: slot ? thDate(slot.pickup_date, slot.pickup_time) : null,
    pickup_slot_id: o.pickup_slot_id, created_at: o.created_at,
    qty_received: null, qty_sold: null, qty_remaining: null,
    stock_deducted: false, attachment_url: null, attachment_path: null,
    crop_type: null, supplier_name: null, sale_order_id: o.id, closed_at: null,
    _source: 'sale_order' as const,
  };
}

export async function queryReservations(
  s: SupabaseClient,
  status: string,
  memberId: string,
) {
  let seedQ = s.from('admin_seed_reservations').select('*').limit(200);
  if (status)   seedQ = seedQ.eq('status', status);
  if (memberId) seedQ = seedQ.eq('member_id', memberId);
  const { data: seedRows, error: seedErr } = await seedQ;
  if (seedErr) throw new Error(seedErr.message);

  let soQ = s.from('sale_orders').select(`
    id, order_number, order_type, status, created_at,
    member_id, note, total, pickup_slot_id, source_type,
    member:members!sale_orders_member_id_fkey(full_name, phone),
    pickup_slot:pickup_slots(pickup_date, pickup_time, pickup_locations(name)),
    order_items(product_id, product_name, product_name_snapshot, product_unit, qty, unit_price)
  `).eq('order_type', 'reservation').limit(200);
  if (status)   soQ = soQ.eq('status', status);
  if (memberId) soQ = soQ.eq('member_id', memberId);
  const { data: soRows, error: soErr } = await soQ;
  if (soErr) throw new Error(soErr.message);

  const all = [
    ...(seedRows ?? []).map((r) => ({ ...r, _source: 'seed_reservation' as const })),
    ...((soRows ?? []) as unknown as SoRow[]).map(normaliseSaleOrder),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return all;
}
