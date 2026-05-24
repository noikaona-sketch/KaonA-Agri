'use client';

import { useEffect, useState } from 'react';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type AdminUserRow = {
  id: string; email: string; full_name: string;
  department: string; status: string; created_at: string;
};

const DEPT_LABELS: Record<string, string> = {
  super_admin: '⭐ Super Admin', admin: '🔑 แอดมิน',
  sales: '💰 ฝ่ายขาย', accounting: '📒 บัญชี',
  finance: '💳 การเงิน', field: '🗺️ ภาคสนาม', stock: '📦 สต๊อก',
};
const STATUS_CFG: Record<string, { label: string; badge: string }> = {
  pending:   { label: '⏳ รออนุมัติ', badge: 'pending'   },
  approved:  { label: '✅ อนุมัติ',   badge: 'approved'  },
  suspended: { label: '⛔ ระงับ',     badge: 'suspended' },
};
const DEPT_LIST = ['admin','sales','accounting','finance','field','stock'];

export function AdminStaffList() {
  const [staff, setStaff]     = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [fEmail, setFEmail]   = useState('');
  const [fName,  setFName]    = useState('');
  const [fDept,  setFDept]    = useState('sales');
  const [fPass,  setFPass]    = useState('');
  const [saving, setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/staff', { credentials: 'include' });
    const d = (await res.json()) as { staff?: AdminUserRow[]; error?: string };
    if (!res.ok) { setError(d.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setStaff(d.staff ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function doAction(action: 'approve' | 'suspend' | 'reactivate' | 'delete', id: string) {
    if (action === 'delete' && !window.confirm('ลบบัญชีเจ้าหน้าที่นี้?')) return;
    setActing(id); setNotice(null);
    const res = await fetch('/api/admin/staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action, admin_user_id: id }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    const msg: Record<string, string> = {
      approve: '✅ อนุมัติแล้ว', suspend: '⛔ ระงับแล้ว',
      reactivate: '✅ เปิดใช้งานแล้ว', delete: '🗑️ ลบแล้ว',
    };
    setNotice(msg[action] ?? '✅ สำเร็จ');
    await load();
  }

  async function register() {
    if (!fEmail || !fPass || !fName) { setNotice('❌ กรอกข้อมูลให้ครบ'); return; }
    if (fPass.length < 8) { setNotice('❌ รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setSaving(true); setNotice(null);
    const res = await fetch('/api/admin/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: fEmail, password: fPass, fullName: fName, department: fDept }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ สร้างบัญชีแล้ว รอ super admin อนุมัติ');
    setShowForm(false); setFEmail(''); setFName(''); setFPass(''); setFDept('sales');
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const pending = staff.filter((s) => s.status === 'pending').length;

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      {pending > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#e65100', fontSize: 14 }}>
          ⏳ รออนุมัติ {pending} บัญชี
        </div>
      )}

      {/* Create form */}
      {showForm ? (
        <div className="kaona-card" style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 15 }}>➕ สร้างบัญชีเจ้าหน้าที่</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="reg-label" style={{ gridColumn: '1/-1' }}>ชื่อ-นามสกุล <span className="reg-required">*</span>
              <input className="reg-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="สมชาย ใจดี" />
            </label>
            <label className="reg-label">อีเมล <span className="reg-required">*</span>
              <input className="reg-input" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="staff@kaona.app" />
            </label>
            <label className="reg-label">รหัสผ่าน <span className="reg-required">*</span>
              <input className="reg-input" type="password" value={fPass} onChange={(e) => setFPass(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" />
            </label>
            <label className="reg-label">แผนก <span className="reg-required">*</span>
              <select className="reg-input" value={fDept} onChange={(e) => setFDept(e.target.value)}>
                {DEPT_LIST.map((d) => <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn--ghost" onClick={() => { setShowForm(false); setNotice(null); }}>ยกเลิก</button>
            <button className="admin-btn admin-btn--primary" onClick={register} disabled={saving}>
              {saving ? 'กำลังสร้าง…' : '💾 สร้างบัญชี'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <button className="admin-btn admin-btn--primary" onClick={() => setShowForm(true)}>➕ สร้างบัญชีเจ้าหน้าที่</button>
        </div>
      )}

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>ชื่อ</th><th>อีเมล</th><th>แผนก</th><th>สถานะ</th><th>สมัครเมื่อ</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีเจ้าหน้าที่</td></tr>
            )}
            {staff.map((s) => {
              const st = STATUS_CFG[s.status] ?? { label: s.status, badge: 'pending' };
              return (
                <tr key={s.id} style={{ opacity: s.status === 'suspended' ? 0.55 : 1 }}>
                  <td style={{ fontWeight: 700 }}>{s.full_name}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{s.email}</td>
                  <td>
                    <span className="role-pill">{DEPT_LABELS[s.department] ?? s.department}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${st.badge}`}>{st.label}</span>
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(s.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {s.status === 'pending' && (
                        <button className="admin-btn admin-btn--success"
                          onClick={() => doAction('approve', s.id)}
                          disabled={acting !== null} style={{ fontSize: 12, height: 30, padding: '0 10px' }}>
                          ✅ อนุมัติ
                        </button>
                      )}
                      {s.status === 'approved' && (
                        <button className="admin-btn admin-btn--secondary"
                          onClick={() => doAction('suspend', s.id)}
                          disabled={acting !== null} style={{ fontSize: 12, height: 30, padding: '0 10px' }}>
                          ⛔ ระงับ
                        </button>
                      )}
                      {s.status === 'suspended' && (
                        <button className="admin-btn admin-btn--success"
                          onClick={() => doAction('reactivate', s.id)}
                          disabled={acting !== null} style={{ fontSize: 12, height: 30, padding: '0 10px' }}>
                          🔓 เปิดใช้
                        </button>
                      )}
                      {s.department !== 'super_admin' && (
                        <button className="admin-btn admin-btn--danger"
                          onClick={() => doAction('delete', s.id)}
                          disabled={acting !== null} style={{ fontSize: 12, height: 30, padding: '0 10px' }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
