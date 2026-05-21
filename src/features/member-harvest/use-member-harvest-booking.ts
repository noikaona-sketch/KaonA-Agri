import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type { BookingStatusRow } from './harvest-booking-status-card';

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

type R = { existing: BookingStatusRow | null; loading: boolean; submit: (p: Record<string, unknown>) => Promise<string | null>; update: (p: Record<string, unknown>) => Promise<string | null>; cancel: (id: string) => Promise<string | null>; refresh: () => Promise<void>; marketPrice: number | null; queueSnapshot: null };

export function useMemberHarvestBooking(cycleId: string, _cropName: string): R {
  const [existing, setExisting] = useState<BookingStatusRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = await getBearerToken();
    const res = await fetch(`/api/member/harvest-bookings?cycle_id=${cycleId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const json = (await res.json()) as { bookings?: BookingStatusRow[] };
    const rows = json.bookings ?? [];
    const pick = rows.find((b) => ['planned', 'pending', 'confirmed'].includes(b.status)) ?? rows[0] ?? null;
    setExisting(pick);
  }

  useEffect(() => { void (async () => { await refresh(); setLoading(false); })(); }, [cycleId]);

  async function mutate(payload: Record<string, unknown>, method: 'POST' | 'PATCH') {
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-bookings', { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) return json.error ?? 'บันทึกไม่สำเร็จ';
    await refresh();
    return null;
  }

  return {
    existing, loading, marketPrice: null, queueSnapshot: null,
    submit: (p) => mutate(p, 'POST'),
    update: (p) => mutate({ action: 'update', ...p }, 'PATCH'),
    cancel: (id) => mutate({ action: 'cancel', id }, 'PATCH'),
    refresh,
  };
}
