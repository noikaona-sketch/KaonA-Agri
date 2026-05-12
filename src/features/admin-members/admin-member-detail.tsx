'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

import { MemberRoleManager } from './member-role-manager';

type MemberDetail = {
  id: string; full_name: string; phone: string | null;
  citizen_id_masked: string; address: string | null;
  status: string; registration_type: string | null;
  line_user_id: string | null; created_at: string;
};
type PlotRow    = { id: string; name: string; area_rai: number; lat: number; lng: number; status: string; province: string | null; land_doc_type: string | null };
type VehicleRow = { id: string; vehicle_type: string; plate_number: string; brand: string | null; model: string | null; year_be: number | null };
type RoleRow    = { role: string; is_primary: boolean };

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: '✅ อนุมัติแล้ว', color: '#1b5e20', bg: '#e8f5e9' },
  pending:   { label: '⏳ รออนุมัติ',   color: '#e65100', bg: '#fff8e1' },
  rejected:  { label: '❌ ไม่อนุมัติ',  color: '#c62828', bg: '#ffebee' },
  suspended: { label: '⛔ ระงับ',        color: '#616161', bg: '#f5f5f5' },
};

export function AdminMemberDetail({ memberId }: { memberId: string }) {
  const [member,   setMember]   = useState<MemberDetail | null>(null);
  const [plots,    setPlots]    = useState<PlotRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [roles,    setRoles]    = useState<RoleRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [acting,   setActing]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const [mR, pR, vR, rR] = await Promise.all([
      s.from('members').select('*').eq('id', memberId).maybeSingle(),
      s.from('plots').select('id,name,area_rai,lat,lng,status,province,land_doc_type').eq('member_id', memberId).is('deleted_at', null),
      s.from('member_vehicles').select('id,vehicle_type,plate_number,brand,model,year_be').eq('member_id', memberId).is('deleted_at', null),
      s.from('member_roles').select('role,is_primary').eq('member_id', memberId),
    ]);
    if (mR.error) { setError(mR.error.message); setLoading(false); return; }
    setMember(mR.data as MemberDetail);
    setPlots((pR.data as PlotRow[]) ?? []);
    setVehicles((vR.data as VehicleRow[]) ?? []);
    setRoles((rR.data as RoleRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [memberId]);

  async function updateStatus(status: 'approved' | 'rejected' | 'suspended' | 'pending') {
    const s = createSupabaseBrowserClient();
    setActing(true); setNotice(null);
    await s.from('members').update({ status }).eq('id', memberId);
    if (status === 'approved') {
      await s.from('approvals').update({ status: 'approved' }).eq('member_id', memberId).eq('status', 'pending');
    }
    setNotice(STATUS_TH[status]?.label ?? status);
    setActing(false);
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลดข้อมูล…" />;
  if (error || !member) return <ErrorState title="ไม่พบข้อมูลสมาชิก" detail={error ?? ''} />;

  const st = STATUS_TH[member.status] ?? { label: member.status, color: '#333', bg: '#f5f5f5' };

  return (
    <div style={{ display: 'grid', gap: 28 }}>

      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
          ✅ {notice}
        </div>
      )}

      {/* Status Banner + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: st.bg, border: `1.5px solid`, borderColor: st.color + '55', borderRadius: 14, padding: '16px 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: st.color }}>{st.label}</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {member.status === 'pending' && <>
            <button className="admin-btn admin-btn--success" onClick={() => updateStatus('approved')} disabled={acting}>✅ อนุมัติ</button>
            <button className="admin-btn admin-btn--danger"  onClick={() => updateStatus('rejected')} disabled={acting}>❌ ไม่อนุมัติ</button>
          </>}
          {member.status === 'approved'  && <button className="admin-btn admin-btn--secondary" onClick={() => updateStatus('suspended')} disabled={acting}>⛔ ระงับบัญชี</button>}
          {member.status === 'rejected'  && <button className="admin-btn admin-btn--success"   onClick={() => updateStatus('pending')}  disabled={acting}>↩️ ให้สมัครใหม่</button>}
          {member.status === 'suspended' && <button className="admin-btn admin-btn--success"   onClick={() => updateStatus('approved')} disabled={acting}>✅ คืนสิทธิ์</button>}
        </div>
      </div>

      {/* ข้อมูลส่วนตัว */}
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>👤 ข้อมูลส่วนตัว</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              {[
                ['ชื่อ-นามสกุล', member.full_name],
                ['เบอร์โทร', member.phone ?? '—'],
                ['เลขบัตรประชาชน', member.citizen_id_masked],
                ['ที่อยู่', member.address ?? '—'],
                ['ประเภทสมัคร', member.registration_type ?? '—'],
                ['วันที่สมัคร', new Date(member.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })],
              ].map(([label, val]) => (
                <tr key={String(label)}>
                  <td style={{ width: 160, fontWeight: 600, color: '#4a6741', background: '#f7faf7', whiteSpace: 'nowrap' }}>{label}</td>
                  <td>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* จัดการสิทธิ์ */}
      <MemberRoleManager
        memberId={memberId}
        memberName={member.full_name}
        currentRoles={roles}
        onRolesUpdated={load}
      />

      {/* แปลง */}
      {plots.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🌾 แปลงเกษตร ({plots.length} แปลง)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ชื่อแปลง</th><th>ไร่</th><th>จังหวัด</th><th>เอกสาร</th><th>พิกัด GPS</th></tr></thead>
              <tbody>
                {plots.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.area_rai}</td>
                    <td>{p.province ?? '—'}</td>
                    <td>{p.land_doc_type ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</td>
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
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🚛 ยานพาหนะ ({vehicles.length} คัน)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ทะเบียน</th><th>ประเภท</th><th>ยี่ห้อ / รุ่น</th><th>ปี</th></tr></thead>
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
