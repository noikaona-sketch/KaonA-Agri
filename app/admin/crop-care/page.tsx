'use client';

import { useEffect, useState }     from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { AdminWebShell }           from '@/shared/components/admin-web-shell';
import { CareScheduleBuilder }     from '@/features/admin-care-schedule/care-schedule-builder';

type CropDefault = { id: string; crop_type: string; care_schedule: unknown[]; updated_at: string };

export default function CropCarePage() {
  const [rows,    setRows]    = useState<CropDefault[]>([]);
  const [editing, setEditing] = useState<CropDefault | null>(null);
  const [json,    setJson]    = useState('[]');
  const [newType, setNewType] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [notice,  setNotice]  = useState<string | null>(null);

  const sb = createSupabaseBrowserClient();

  async function load() {
    const { data } = await sb.from('crop_care_defaults').select('*').order('crop_type');
    setRows((data as CropDefault[]) ?? []);
  }

  useEffect(() => { void load(); }, []);

  function startEdit(row: CropDefault) {
    setEditing(row);
    setJson(JSON.stringify(row.care_schedule, null, 2));
  }

  async function save() {
    let parsed;
    try { parsed = JSON.parse(json); } catch { setNotice('❌ JSON ไม่ถูกต้อง'); return; }
    setSaving(true);
    const cropType = editing?.crop_type ?? newType.trim();
    if (!cropType) { setNotice('❌ กรุณาระบุชนิดพืช'); setSaving(false); return; }
    const { error } = await sb.from('crop_care_defaults').upsert({ crop_type: cropType, care_schedule: parsed }, { onConflict: 'crop_type' });
    setSaving(false);
    if (error) { setNotice(`❌ ${error.message}`); return; }
    setNotice(`✅ บันทึก "${cropType}" แล้ว`);
    setEditing(null); setNewType('');
    void load();
  }

  return (
    <AdminWebShell title="🌱 ตารางดูแลพืช" subtitle="จัดการ Care Schedule ต่อชนิดพืช">
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {notice && (
          <div style={{ padding: '10px 16px', borderRadius: 10, background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', fontWeight: 600, fontSize: 13 }}>
            {notice}
          </div>
        )}

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(row => (
            <div key={row.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{row.crop_type}</span>
                <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af' }}>
                  {(row.care_schedule as unknown[]).length} กิจกรรม · อัปเดต {new Date(row.updated_at).toLocaleDateString('th-TH', { day:'numeric', month:'short' })}
                </span>
              </div>
              <button onClick={() => startEdit(row)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                ✏️ แก้ไข
              </button>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>
            {editing ? `✏️ แก้ไข — ${editing.crop_type}` : '+ เพิ่มพืชใหม่'}
          </h3>

          {!editing && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>ชนิดพืช</label>
              <input value={newType} onChange={e => setNewType(e.target.value)}
                placeholder="เช่น ข้าวโพด, ข้าว, มันสำปะหลัง" className="reg-input" style={{ maxWidth: 300 }} />
            </div>
          )}

          <CareScheduleBuilder
            value={json}
            onChange={setJson}
            label={`Care Schedule — ${editing?.crop_type ?? newType || 'พืช'}`}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {editing && (
              <button onClick={() => { setEditing(null); setJson('[]'); }}
                style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', fontSize: 13 }}>
                ยกเลิก
              </button>
            )}
            <button onClick={save} disabled={saving}
              style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </AdminWebShell>
  );
}
