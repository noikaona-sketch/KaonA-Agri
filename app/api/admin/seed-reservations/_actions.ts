import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sendLineMessage,
  seedConfirmedMessage,
  seedCancelledMessage,
} from '@/lib/line/push-message';

type Source = 'seed_reservation' | 'sale_order';

function thDate(d: string, time?: string) {
  const base = new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  return time ? `${base} ${time}` : base;
}

async function getPushInfo(s: SupabaseClient, id: string, source: Source) {
  if (source === 'sale_order') {
    const { data } = await s.from('sale_orders')
      .select('order_number,members!sale_orders_member_id_fkey(line_user_id),order_items(product_name,product_name_snapshot,product_unit,qty),pickup_slots(pickup_date,pickup_time)')
      .eq('id', id).single();
    if (!data) return null;
    const m    = data.members as unknown as { line_user_id: string | null } | null;
    const item = (data.order_items as { product_name: string; product_name_snapshot: string | null; product_unit: string; qty: number }[])?.[0];
    const slot = data.pickup_slots as unknown as { pickup_date: string; pickup_time: string } | null;
    return { lineUserId: m?.line_user_id ?? null, reservationNo: data.order_number,
      productName: item?.product_name ?? item?.product_name_snapshot ?? '—',
      qty: item?.qty ?? 0, unit: item?.product_unit ?? 'ถุง',
      pickupDate: slot ? thDate(slot.pickup_date, slot.pickup_time) : null };
  }
  const { data } = await s.from('seed_reservations')
    .select('reservation_no,variety_name,qty_reserved,pickup_date,members!seed_reservations_member_id_fkey(line_user_id)')
    .eq('id', id).single();
  if (!data) return null;
  const m = data.members as unknown as { line_user_id: string | null } | null;
  return { lineUserId: m?.line_user_id ?? null, reservationNo: data.reservation_no,
    productName: data.variety_name, qty: Number(data.qty_reserved), unit: 'ถุง',
    pickupDate: data.pickup_date ? thDate(data.pickup_date) : null };
}

export async function confirmReservation(s: SupabaseClient, body: {
  reservation_id: string; source: Source;
  source_channel?: string; attachment_url?: string; attachment_path?: string;
}, now: string) {
  if (body.source === 'sale_order') {
    const { error } = await s.from('sale_orders')
      .update({ status: 'confirmed', updated_at: now } as Record<string, unknown>)
      .eq('id', body.reservation_id).eq('status', 'pending');
    if (error) throw new Error(error.message);
  } else {
    const patch: Record<string, unknown> = { status: 'confirmed', updated_at: now };
    if (body.source_channel)  patch.source_channel  = body.source_channel;
    if (body.attachment_url)  patch.attachment_url  = body.attachment_url;
    if (body.attachment_path) patch.attachment_path = body.attachment_path;
    const { error } = await s.from('seed_reservations').update(patch).eq('id', body.reservation_id).eq('status', 'pending');
    if (error) throw new Error(error.message);
  }
  const info = await getPushInfo(s, body.reservation_id, body.source);
  if (info) await sendLineMessage(info.lineUserId, [seedConfirmedMessage(info.reservationNo, info.productName, info.qty, info.unit, info.pickupDate)]);
}

export async function cancelReservation(s: SupabaseClient, body: {
  reservation_id: string; source: Source; reason?: string;
}, now: string) {
  const info = await getPushInfo(s, body.reservation_id, body.source);
  if (body.source === 'sale_order') {
    const { error } = await s.from('sale_orders')
      .update({ status: 'cancelled', updated_at: now } as Record<string, unknown>)
      .eq('id', body.reservation_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await s.rpc('cancel_reservation', { p_reservation_id: body.reservation_id, p_reason: body.reason ?? null });
    if (error) throw new Error(error.message);
  }
  if (info) await sendLineMessage(info.lineUserId, [seedCancelledMessage(info.reservationNo, body.reason)]);
}

export async function closeReservation(s: SupabaseClient, body: {
  action: 'close_partial' | 'close_full';
  reservation_id: string; source: Source;
  qty_sold?: number; qty_remaining?: number; sale_order_id?: string;
}, now: string) {
  if (body.action === 'close_partial') {
    const { error } = await s.from('seed_reservations').update({
      status: 'partial', qty_sold: body.qty_sold ?? null,
      qty_remaining: body.qty_remaining ?? null,
      sale_order_id: body.sale_order_id ?? null, updated_at: now,
    }).eq('id', body.reservation_id);
    if (error) throw new Error(error.message);
    return;
  }
  const isSO  = body.source === 'sale_order';
  const table = isSO ? 'sale_orders' : 'seed_reservations';
  const patch = isSO
    ? { status: 'completed', updated_at: now }
    : { status: 'converted', qty_sold: body.qty_sold ?? null, sale_order_id: body.sale_order_id ?? null, closed_at: now, updated_at: now };
  const { error } = await s.from(table as 'sale_orders').update(patch as Record<string, unknown>).eq('id', body.reservation_id);
  if (error) throw new Error(error.message);
}
