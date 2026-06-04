'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนดที่ดิน (นส.4)' },
  { value: 'ns3k',       label: 'นส.3ก' },
  { value: 'ns3',        label: 'นส.3' },
  { value: 'sk1',        label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },
  { value: 'other',      label: 'เอกสารอื่น' },
];

export default function AddPlotPage() {
  const router = useRouter();
  const { status } = useAuth();
  const member = useCurrentMember();

  const [name,        setName]        = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [province,    setProvince]    = useState('');
  const [landDocType, setLandDocType] = useState('');
  const [landDocNum,  setLandDocNum]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Wait for auth to finish loading — same pattern as planting-cycles ────────
  if (status === 'loading') {
    return <LoadingState label="กำลังโหลด…" />;
  }

  async function handleSubmit() {
    if (!member?.member_id) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!name.trim() || !areaRai) {
      setError('กรุณากรอกชื่อแปลงและพื้นที่ให้ครบ'); return;
    }
    setSubmitting(true); setError(null);

    // ── Get Supabase Bearer token (set by auth-provider after LINE login) ─────
    const supabase = tryCreateSupabaseBrowserClient();
    const sessionData = supabase ? await supabase.auth.getSession() : null;
    const accessToken = sessionData?.data?.session?.access_token ?? null;

    // ── Diagnostic: compare auth resolution approaches ────────────────────────
    console.log('[ADD_PLOT] pre-submit diagnostics', {
      'member.member_id':                      member.member_id,
      'member.line_user_id':                   member.line_user_id,
      'member.auth_user_id':                   member.auth_user_id ?? null,
      'supabase session access_token present': accessToken !== null,
      'access_token preview': accessToken ? `${accessToken.slice(0, 20)}…` : null,
      'auth.status': status,
      'resolve order': accessToken
        ? '1. Bearer token → resolveApprovedMember (same as planting-cycle)'
        : '2. line_user_id fallback → resolveApprovedMember',
    });

    // ── Build FormData ────────────────────────────────────────────────────────
    // GPS is disabled — lat/lng are not included.
    const form = new FormData();
    form.append('name',     name.trim());
    form.append('area_rai', areaRai);
    if (province)    form.append('province',         province);
    if (landDocType) form.append('land_doc_type',    landDocType);
    if (landDocNum)  form.append('land_doc_number',  landDocNum);

    // ── Build request headers ─────────────────────────────────────────────────
    // Bearer token → resolveApprovedMember uses it as source of truth.
    // If no Bearer (LIFF session not bridged to Supabase yet), the route
    // falls back to line_user_id query param — same fallback planting-cycles uses.
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Build URL with line_user_id fallback (matches resolveApprovedMember fallback)
    const url = new URL('/api/member/plot-registration', window.location.origin);
    if (!accessToken && member.line_user_id) {
      url.searchParams.set('line_user_id', member.line_user_id);
    }

    console.log('[ADD_PLOT] sending request', {
      url: url.pathname + url.search,
      hasBearer: !!accessToken,
      hasFallbackLineUserId: !accessToken && !!member.line_user_id,
    });

    const res = await fetch(url.toString(), {
      method:  'POST',
      headers,
      body:    form,
    });

    const data = (await res.json()) as {
      ok?: boolean; plot_id?: string; error?: string; photo_warnings?: string[];
    };
    setSubmitting(false);

    if (!res.ok) {
      console.error('[ADD_PLOT] server error', { status: res.status, error: data.error });
      setError(data.error ?? 'บันทึกไม่สำเร็จ');
      return;
    }

    console.log('[ADD_PLOT] success', {
      plotId: data.plot_id,
      photoWarnings: data.photo_warnings ?? [],
    });

    router.replace('/plots');
  }

  return (
    <MobileAppShell title="เพิ่มแปลงใหม่" subtitle="ลงทะเบียนแปลงเกษตรของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>

        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        <label className="reg-label">ชื่อแปลง <span className="reg-required">*</span>
          <input className="reg-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น แปลงนาหมู่บ้าน" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">พื้นที่ (ไร่) <span className="reg-required">*</span>
            <input className="reg-input" type="number" inputMode="decimal" min="0" step="0.25"
              value={areaRai} onChange={(e) => setAreaRai(e.target.value)} placeholder="0.00" />
          </label>
          <label className="reg-label">จังหวัด
            <input className="reg-input" value={province} onChange={(e) => setProvince(e.target.value)}
              placeholder="บุรีรัมย์" />
          </label>
        </div>

        <label className="reg-label">ประเภทเอกสารสิทธิ์
          <select className="reg-input" value={landDocType} onChange={(e) => setLandDocType(e.target.value)}>
            <option value="">ไม่มี / ไม่ระบุ</option>
            {LAND_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        {landDocType && (
          <label className="reg-label">เลขที่เอกสาร
            <input className="reg-input" value={landDocNum} onChange={(e) => setLandDocNum(e.target.value)}
              placeholder="เลขโฉนด / เลขเอกสาร" />
          </label>
        )}

        {/* GPS temporarily disabled for LINE mobile users. */}
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: '6px 0 0' }}>
          ระบบจะบันทึกแปลงโดยยังไม่ต้องจับพิกัด GPS ชั่วคราว
        </p>

        <UIButton
          fullWidth
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting || !name.trim() || !areaRai || !member?.member_id}
        >
          ✅ บันทึกแปลง
        </UIButton>

        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>
          ← ยกเลิก
        </UIButton>
      </div>
    </MobileAppShell>
  );
}
