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
    dryerQuota: { date: string; capacity_kg: number | null; booked_kg: number; remaining_kg: number | null; util_pct: number | null; level: string }[];
  } | null;
  loading:      boolean;
  submit:       (payload: Record<string, unknown>) => Promise<string | null>;
  update:       (payload: Record<string, unknown>) => Promise<string | null>;
};

export function useMemberHarvestBooking(
  cycleId: string,
  cropName: string,
): UseMemberHarvestBookingResult {
  const [existing,    setExisting]    = useState<BookingStatusRow | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<UseMemberHarvestBookingResult['queueSnapshot']>(null);
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

      // Read-only queue snapshot for lightweight contextual hints
      const today = new Date();
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);

      const { data: queueRows } = await sb
        .from('harvest_bookings')
        .select('status,expected_date_from,requires_dryer,estimated_moisture')
        .in('status', ['planned'])
        .gte('expected_date_from', toIso(today))
        .lte('expected_date_from', toIso(in7Days));

      // Dryer quota จาก pickup_slots — แสดงให้ farmer เห็นก่อนจอง
      const { data: slotRows } = await sb
        .from('pickup_slots')
        .select('pickup_date,capacity_kg_dryer,booked_kg_dryer,status')
        .eq('status', 'open')
        .gte('pickup_date', toIso(today))
        .lte('pickup_date', toIso(in7Days))
        .order('pickup_date');

      const dryerQuota = (slotRows ?? []).map((s) => {
        const cap      = s.capacity_kg_dryer ? Number(s.capacity_kg_dryer) : null;
        const booked   = Number(s.booked_kg_dryer ?? 0);
        const utilPct  = cap ? Math.round((booked / cap) * 100) : null;
        return {
          date:         s.pickup_date as string,
          capacity_kg:  cap,
          booked_kg:    booked,
          remaining_kg: cap != null ? Math.max(0, cap - booked) : null,
          util_pct:     utilPct,
          level:        utilPct == null ? 'unknown' : utilPct >= 90 ? 'full' : utilPct >= 60 ? 'busy' : 'available',
        };
      });

      if (queueRows) {
        const nearTermCount = queueRows.length;
        setQueueSnapshot({
          pendingCount:          queueRows.filter((r) => r.status === 'planned').length,
          nearTermCount,
          dryerRequiredCount:    queueRows.filter((r) => r.requires_dryer).length,
          moistureSensitiveCount:queueRows.filter((r) => Number(r.estimated_moisture ?? 0) >= 28).length,
          dryerQuota,
        });
      }

      // Existing active booking
      const token = await getBearerToken();
      const { headers: authH, url: authUrl } = await getAuthHeaders(member!, '/api/member/harvest-bookings');
      const res = await fetch(authUrl, {
        headers: authH,
      });
      if (res.ok) {
        const json = (await res.json()) as { bookings?: BookingStatusRow[] };
        const active = json.bookings?.find(
          (b) => b.status === 'planned',
        ) ?? null;
        setExisting(active);
      }
      setLoading(false);
    })();
  }, [cycleId, cropName]);

  async function submit(payload: Record<string, unknown>): Promise<string | null> {
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-bookings', {
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

  async function update(payload: Record<string, unknown>): Promise<string | null> {
    const token = await getBearerToken();
    const { headers: authH2, url: authUrl2 } = await getAuthHeaders(member!, '/api/member/harvest-bookings');
    const res = await fetch(authUrl2, {
      method: 'PATCH',
      headers: { ...authH2, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.error) return json.error ?? 'บันทึกไม่สำเร็จ';
    return null;
  }

  return { existing, marketPrice, queueSnapshot, loading, submit, update };
}

