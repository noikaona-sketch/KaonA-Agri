'use client';

import { useEffect, useRef, useState } from 'react';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type PlotRow = {
  id: string; name: string; area_rai: number;
  lat: number | null; lng: number | null; accuracy: number | null;
  status: string; created_at: string;
  province: string | null; district: string | null;
  subdistrict: string | null; village: string | null;
  land_doc_type: string | null; land_doc_number: string | null;
  description: string | null;
  boundary_geojson: object | null; area_rai_calculated: number | null;
  member: { id: string; full_name: string; phone: string | null } | null;
};

type MemberOption = { id: string; full_name: string; phone: string | null };

const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนด (นส.4)' },
  { value: 'ns3k',       label: 'นส.3ก' },
  { value: 'ns3',        label: 'นส.3' },
  { value: 'sk1',        label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },
  { value: 'other',      label: 'อื่นๆ' },
];
const LAND_DOC_TH: Record<string, string> = Object.fromEntries(LAND_DOC_TYPES.map(t => [t.value, t.label]));

const STATUS_OPTIONS = [
  { value: 'active',         label: 'ใช้งาน' },
  { value: 'pending_review', label: 'รอตรวจสอบ' },
  { value: 'inactive',       label: 'ไม่ใช้งาน' },
];

const INPUT = {
  padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontSize: 13, width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit',
};
const LABEL = { display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' } as React.CSSProperties;

// ── Empty plot form state ─────────────────────────────────────────────────────
function emptyForm() {
  return {
    member_id: '', name: '', area_rai: '',
    province: 'อุบลราชธานี', district: '', subdistrict: '', village: '',
    land_doc_type: '', land_doc_number: '', description: '',
    status: 'active', lat: '', lng: '',
  };
}

type FormState = ReturnType<typeof emptyForm>;

function plotToForm(p: PlotRow): FormState {
  return {
    member_id:       p.member?.id ?? '',
    name:            p.name,
    area_rai:        String(p.area_rai),
    province:        p.province        ?? '',
    district:        p.district        ?? '',
    subdistrict:     p.subdistrict     ?? '',
    village:         p.village         ?? '',
    land_doc_type:   p.land_doc_type   ?? '',
    land_doc_number: p.land_doc_number ?? '',
    description:     p.description     ?? '',
    status:          p.status,
    lat:             p.lat  != null ? String(p.lat)  : '',
    lng:             p.lng  != null ? String(p.lng)  : '',
  };
}

// ── Drawer component ──────────────────────────────────────────────────────────
function PlotDrawer({
  title, form, setForm, members, saving, error, onSave, onClose,
}: {
  title: string;
  form: FormState;
  setForm: (f: FormState) => void;
  members: MemberOption[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      {/* Backdrop */}
      <div style={{ flex: 1, background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      {/* Panel */}
      <div style={{ width: 480, background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 13 }}>{error}</div>}

          {/* สมาชิก */}
          <label style={LABEL}>สมาชิก *
            <select style={INPUT} value={form.member_id} onChange={set('member_id')}>
              <option value="">— เลือกสมาชิก —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}{m.phone ? ` · ${m.phone}` : ''}</option>
              ))}
            </select>
          </label>

          {/* ชื่อแปลง + พื้นที่ */}
          <label style={LABEL}>ชื่อแปลง *
            <input style={INPUT} value={form.name} onChange={set('name')} placeholder="เช่น แปลงนาหมู่บ้าน" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LABEL}>พื้นที่ (ไร่) *
              <input style={INPUT} type="number" min="0" step="0.25" value={form.area_rai} onChange={set('area_rai')} placeholder="0.00" />
            </label>
            <label style={LABEL}>สถานะ
              <select style={INPUT} value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {/* ที่อยู่ */}
          <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 12, color: '#6B7280' }}>📮 ที่อยู่</p>
          <label style={LABEL}>จังหวัด
            <input style={INPUT} value={form.province} onChange={set('province')} placeholder="อุบลราชธานี" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LABEL}>อำเภอ
              <input style={INPUT} value={form.district} onChange={set('district')} placeholder="อำเภอ" />
            </label>
            <label style={LABEL}>ตำบล
              <input style={INPUT} value={form.subdistrict} onChange={set('subdistrict')} placeholder="ตำบล" />
            </label>
          </div>
          <label style={LABEL}>หมู่บ้าน
            <input style={INPUT} value={form.village} onChange={set('village')} placeholder="บ้าน…" />
          </label>

          {/* GPS */}
          <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 12, color: '#6B7280' }}>📍 GPS (ไม่บังคับ)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LABEL}>Lat
              <input style={INPUT} type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="14.xxx" />
            </label>
            <label style={LABEL}>Lng
              <input style={INPUT} type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="100.xxx" />
            </label>
          </div>

          {/* เอกสารสิทธิ์ */}
          <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 12, color: '#6B7280' }}>📄 เอกสารสิทธิ์</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LABEL}>ประเภท
              <select style={INPUT} value={form.land_doc_type} onChange={set('land_doc_type')}>
                <option value="">ไม่มี / ไม่ระบุ</option>
                {LAND_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={LABEL}>เลขที่เอกสาร
              <input style={INPUT} value={form.land_doc_number} onChange={set('land_doc_number')} placeholder="เลขโฉนด…" />
            </label>
          </div>

          {/* หมายเหตุ */}
          <label style={LABEL}>หมายเหตุ
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={2}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="บันทึกเพิ่มเติม…" />
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#374151' }}>
            ยกเลิก
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: saving ? '#D1FAE5' : '#2D6A4F', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdminPlotsList() {
  const [plots,    setPlots]    = useState<PlotRow[]>([]);
  const [members,  setMembers]  = useState<MemberOption[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  // Drawer state
  const [drawerMode,  setDrawerMode]  = useState<'create' | 'edit' | null>(null);
  const [editTarget,  setEditTarget]  = useState<PlotRow | null>(null);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [formError,   setFormError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [notice,      setNotice]      = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [plotsRes, membersRes] = await Promise.all([
      fetch('/api/admin/plots', { credentials: 'include' }),
      fetch('/api/admin/members/list?status=approved', { credentials: 'include' }),
    ]);
    const pd = (await plotsRes.json()) as { plots?: PlotRow[]; error?: string };
    const md = (await membersRes.json()) as { members?: MemberOption[]; error?: string };
    if (!plotsRes.ok) setError(pd.error ?? 'โหลดแปลงไม่สำเร็จ');
    else setPlots(pd.plots ?? []);
    setMembers((md.members ?? []) as MemberOption[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setForm(emptyForm()); setFormError(null);
    setEditTarget(null); setDrawerMode('create');
  }

  function openEdit(p: PlotRow) {
    setForm(plotToForm(p)); setFormError(null);
    setEditTarget(p); setDrawerMode('edit');
  }

  function closeDrawer() { setDrawerMode(null); setEditTarget(null); }

  async function handleSave() {
    if (!form.member_id) { setFormError('กรุณาเลือกสมาชิก'); return; }
    if (!form.name.trim()) { setFormError('กรุณาระบุชื่อแปลง'); return; }
    if (!form.area_rai || Number(form.area_rai) <= 0) { setFormError('กรุณาระบุพื้นที่ (ไร่)'); return; }
    setSaving(true); setFormError(null);

    const payload = {
      member_id:       form.member_id,
      name:            form.name.trim(),
      area_rai:        Number(form.area_rai),
      lat:             form.lat  ? Number(form.lat)  : null,
      lng:             form.lng  ? Number(form.lng)  : null,
      province:        form.province    || null,
      district:        form.district    || null,
      subdistrict:     form.subdistrict || null,
      village:         form.village     || null,
      land_doc_type:   form.land_doc_type   || null,
      land_doc_number: form.land_doc_number || null,
      description:     form.description    || null,
      status:          form.status,
    };

    let res: Response;
    if (drawerMode === 'create') {
      res = await fetch('/api/admin/plots', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/plots', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plot_id: editTarget!.id, ...payload }),
      });
    }

    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setFormError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }

    setNotice(drawerMode === 'create' ? '✅ เพิ่มแปลงแล้ว' : '✅ อัปเดตแปลงแล้ว');
    closeDrawer();
    void load();
    setTimeout(() => setNotice(null), 3000);
  }

  if (loading) return <LoadingState label="กำลังโหลดแปลง…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const filtered = plots.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || (p.member?.full_name ?? '').toLowerCase().includes(q)
      || (p.province ?? '').toLowerCase().includes(q)
      || (p.district ?? '').toLowerCase().includes(q);
  });

  const totalRai = filtered.reduce((s, p) => s + Number(p.area_rai), 0);

  return (
    <div>
      {notice && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, background: '#D1FAE5', color: '#065F46', fontWeight: 600, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
          <input placeholder="ค้นหาชื่อแปลง ชื่อสมาชิก จังหวัด…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
          {filtered.length} แปลง · {totalRai.toLocaleString('th-TH', { maximumFractionDigits: 1 })} ไร่รวม
        </span>
        <button onClick={openCreate}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2D6A4F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ＋ เพิ่มแปลง
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 24px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 36, marginBottom: 8, opacity: .4 }}>🌾</div>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>ไม่พบแปลง</p>
            <p style={{ fontSize: 13 }}>ลองค้นหาด้วยคำอื่น หรือกด "เพิ่มแปลง"</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1.5px solid #E5E7EB' }}>
                  {['ชื่อแปลง', 'เจ้าของ', 'ไร่', 'จังหวัด / อำเภอ / ตำบล', 'เอกสาร', 'GPS', 'สถานะ', 'วันที่', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <td style={{ padding: '11px 12px' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{p.name}</p>
                      {p.village && <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9CA3AF' }}>{p.village}</p>}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#374151' }}>{p.member?.full_name ?? '—'}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 700, color: '#2D6A4F', whiteSpace: 'nowrap' }}>
                      {Number(p.area_rai).toLocaleString('th-TH', { maximumFractionDigits: 1 })}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: '#6B7280' }}>
                      {[p.province, p.district, p.subdistrict].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: '#6B7280' }}>
                      {LAND_DOC_TH[p.land_doc_type ?? ''] ?? p.land_doc_type ?? '—'}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                      {(p.lat && p.lat !== 0) ? <span style={{ color: '#10B981' }}>✓</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        background: p.status === 'active' ? '#D1FAE5' : p.status === 'pending_review' ? '#FEF3C7' : '#F3F4F6',
                        color: p.status === 'active' ? '#065F46' : p.status === 'pending_review' ? '#92400E' : '#6B7280',
                      }}>
                        {p.status === 'active' ? 'ใช้งาน' : p.status === 'pending_review' ? 'รอตรวจ' : p.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <button onClick={() => openEdit(p)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerMode && (
        <PlotDrawer
          title={drawerMode === 'create' ? '➕ เพิ่มแปลงให้สมาชิก' : `✏️ แก้ไข: ${editTarget?.name}`}
          form={form}
          setForm={setForm}
          members={members}
          saving={saving}
          error={formError}
          onSave={handleSave}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
