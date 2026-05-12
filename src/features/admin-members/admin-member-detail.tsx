'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type MemberDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string;
  address: string | null;
  status: string;
  registration_type: string | null;
  line_user_id: string | null;
  created_at: string;
};

type PlotRow = { id: string; name: string; area_rai: number; lat: number; lng: number; status: string; province: string | null; land_doc_type: string | null; };
type VehicleRow = { id: string; vehicle_type: string; plate_number: string; brand: string | null; model: string | null; year_be: number | null; };
type RoleRow = { role: string; is_primary: boolean; };

const STATUS_TH: Record<string, string> = { approved: '✅ อนุมัติแล้ว', pending: '⏳ รออนุมัติ', rejected: '❌ ไม่อนุมัติ', suspended: '⛔ ระงับ' };
const ROLE_ICONS: Record<string, string> = { farmer: '🌾', truck_owner: '🚛', inspector: '🔍', staff: '👷', leader: '👥', admin: '⚙️' };

type Props = { memberId: string };

export function AdminMemberDetail({ memberId }: Props) {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [plots, setPlots]   = useState<PlotRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [roles, setRoles]   = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [mRes, pRes, vRes, rRes] = await Promise.all([
      supabase.from('members').select('*').eq('id', memberId).maybeSingle(),
      supabase.from('plots').select('id,name,area_rai,lat,lng,status,province,land_doc_type').eq('member_id', memberId).is('deleted_at', null),
      supabase.from('member_vehicles').select('id,vehicle_type,plate_number,brand,model,year_be').eq('member_id', memberId).is('deleted_at', null),
      supabase.from('member_roles').select('role,is_primary').eq('member_id', memberId),
    ]);
    if (mRes.error) { setError(mRes.error.message); setLoading(false); return; }
    setMember(mRes.data as MemberDetail);
    setPlots((pRes.data as PlotRow[]) ?? []);
    setVehicles((vRes.data as VehicleRow[]) ?? []);
    setRoles((rRes.data as RoleRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [memberId]);

  async function updateStatus(status: 'approved' | 'rejected' | 'suspended') {
    if (!window.confirm(`เปลี่ยนสถานะเป็น "${STATUS_TH[status]}"?`)) return;
    setActing(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.from('members').update({ status }).eq('id', memberId);
    if (status === 'approved') {
      await supabase.from('approvals')
        .update({ status: 'approved' })
        .eq('member_id', memberId).eq('status', 'pending');
    }
    setNotice(`เปลี่ยนสถานะเป็น ${STATUS_TH[status]} แล้ว`);
    setActing(false);
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลดข้อมูลสมาชิก…" />;
  if (error || !member) return <ErrorState title="ไม่พบข้อมูลสมาชิก" detail={error ?? ''} />;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', color: '#1b5e20', fontWeight: 600 }}>{notice}</div>}

      {/* Header actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {member.status === 'pending' && <>
          <button className="admin-btn admin-btn--success" onClick={() => updateStatus('approved')} disabled={acting}>✅ อนุมัติ</button>
          <button className="admin-btn admin-btn--danger" onClick={() => updateStatus('rejected')} disabled={acting}>❌ ไม่อนุมัติ</button>
        </>}
        {member.status === 'approved' && <button className="admin-btn admin-btn--secondary" onClick={() => updateStatus('suspended')} disabled={acting}>⛔ ระงับบัญชี</button>}
        {member.status === 'suspended' && <button className="admin-btn admin-btn--success" onClick={() => updateStatus('approved')} disabled={acting}>✅ คืนสิทธิ์</button>}
      </div>

      {/* ข้อมูลส่วนตัว */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>👤 ข้อมูลส่วนตัว</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              {[
                ['ชื่อ-นามสกุล', member.full_name],
                ['เบอร์โทร', member.phone ?? '—'],
                ['เลขบัตรประชาชน', member.citizen_id_masked],
                ['ที่อยู่', member.address ?? '—'],
                ['สถานะ', <span className={`status-badge status-badge--${member.status}`}>{STATUS_TH[member.status]}</span>],
                ['บทบาท', <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{roles.map((r) => <span key={r.role} className="role-pill">{ROLE_ICONS[r.role] ?? ''} {r.role}{r.is_primary ? ' ★' : ''}</span>)}</div>],
                ['ประเภทสมัคร', member.registration_type ?? '—'],
                ['LINE ID', member.line_user_id ? `${member.line_user_id.slice(0, 12)}…` : '—'],
                ['วันที่สมัคร', new Date(member.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })],
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td style={{ width: 160, fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* แปลง */}
      {plots.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🌾 แปลงเกษตร ({plots.length} แปลง)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ชื่อแปลง</th><th>พื้นที่ (ไร่)</th><th>จังหวัด</th><th>เอกสาร</th><th>พิกัด</th><th>สถานะ</th></tr></thead>
              <tbody>
                {plots.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.area_rai}</td>
                    <td>{p.province ?? '—'}</td>
                    <td>{p.land_doc_type ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td>
                    <td><span className={`status-badge status-badge--${p.status === 'active' ? 'approved' : 'pending'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* รถ */}
      {vehicles.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🚛 ยานพาหนะ ({vehicles.length} คัน)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ทะเบียน</th><th>ประเภท</th><th>ยี่ห้อ/รุ่น</th><th>ปี</th></tr></thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, letterSpacing: 1 }}>{v.plate_number}</td>
                    <td>{v.vehicle_type}</td>
                    <td>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td>{v.year_be ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
