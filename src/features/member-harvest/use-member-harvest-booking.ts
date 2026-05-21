import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type { BookingStatusRow }           from './harvest-booking-status-card';

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

type UseMemberHarvestBookingResult = {
  existing:     BookingStatusRow | null;
  marketPrice:  number | null;
  queueSnapshot: {
    pendingCount: number;
    nearTermCount: number;
    dryerRequiredCount: number;
    moistureSensitiveCount: number;
  } | null;
  loading:      boolean;
  submit:       (payload: Record<string, unknown>) => Promise<string | null>;
  update:       (payload: Record<string, unknown>) => Promise<string | null>;
  cancel:       (bookingId: string) => Promise<string | null>;
  refresh:      () => Promise<void>;
};

export function useMemberHarvestBooking(
  cycleId: string,
  cropName: string,
): UseMemberHarvestBookingResult {
  const [existing,    setExisting]    = useState<BookingStatusRow | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<UseMemberHarvestBookingResult['queueSnapshot']>(null);
  const [loading,     setLoading]     = useState(true);

  async function refresh() {
    const token = await getBearerToken();
    const res = await fetch(`/api/member/harvest-booking?cycle_id=${cycleId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const json = (await res.json()) as { bookings?: BookingStatusRow[] };
    setExisting((json.bookings ?? [])[0] ?? null);
  }

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }

    void (async () => {
      const { data: price } = await sb
        .from('market_prices')
        .select('price_per_kg')
        .eq('is_active', true)
        .ilike('crop_type', `%${cropName}%`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (price) setMarketPrice(Number(price.price_per_kg));

      const today = new Date();
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);

      const { data: queueRows } = await sb
        .from('harvest_bookings')
        .select('status,scheduled_date,drying_preference,estimated_moisture_pct')
        .in('status', ['pending', 'confirmed'])
        .gte('scheduled_date', toIso(today))
        .lte('scheduled_date', toIso(in7Days));

      if (queueRows) {
        const nearTermCount = queueRows.length;
        setQueueSnapshot({
          pendingCount: queueRows.filter((r) => r.status === 'pending').length,
          nearTermCount,
          dryerRequiredCount: queueRows.filter((r) => r.drying_preference === 'required').length,
          moistureSensitiveCount: queueRows.filter((r) => Number(r.estimated_moisture_pct ?? 0) >= 28).length,
        });
      }

      await refresh();
      setLoading(false);
    })();
  }, [cycleId, cropName]);

  async function submit(payload: Record<string, unknown>): Promise<string | null> {
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-booking', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.error) return json.error ?? 'บันทึกไม่สำเร็จ';
    await refresh();
    return null;
  }

  async function update(payload: Record<string, unknown>): Promise<string | null> {
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-booking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: 'update', ...payload }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) return json.error ?? 'แก้ไขไม่สำเร็จ';
    await refresh();
    return null;
  }

  async function cancel(bookingId: string): Promise<string | null> {
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-booking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id: bookingId, action: 'cancel' }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) return json.error ?? 'ยกเลิกไม่สำเร็จ';
    await refresh();
    return null;
  }

  return { existing, marketPrice, queueSnapshot, loading, submit, update, cancel, refresh };
}
