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
  loading:      boolean;
  submit:       (payload: Record<string, unknown>) => Promise<string | null>;
};

export function useMemberHarvestBooking(
  cycleId: string,
  cropName: string,
): UseMemberHarvestBookingResult {
  const [existing,    setExisting]    = useState<BookingStatusRow | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }

    void (async () => {
      // Market price
      const { data: price } = await sb
        .from('market_prices')
        .select('price_per_kg')
        .eq('is_active', true)
        .ilike('crop_type', `%${cropName}%`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (price) setMarketPrice(Number(price.price_per_kg));

      // Existing active booking
      const token = await getBearerToken();
      const res = await fetch(`/api/member/harvest-booking?cycle_id=${cycleId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = (await res.json()) as { bookings?: BookingStatusRow[] };
        const active = json.bookings?.find(
          (b) => b.status === 'pending' || b.status === 'confirmed',
        ) ?? null;
        setExisting(active);
      }
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
    return null;
  }

  return { existing, marketPrice, loading, submit };
}
