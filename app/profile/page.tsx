'use client';

import Link from 'next/link';
import { useCurrentMember, useCurrentRoles, useEffectiveRole } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';

const ROLE_TH: Record<string, string> = {
  farmer: 'เกษตรกร', truck_owner: 'ทีมบริการ',
  inspector: 'ผู้ตรวจสอบ', staff: 'เจ้าหน้าที่',
  leader: 'หัวหน้ากลุ่ม', admin: 'แอดมิน',
};

export default function ProfilePage() {
  const member        = useCurrentMember();
  const roles         = useCurrentRoles();
  const effectiveRole = useEffectiveRole();

  if (!member) return <LoadingState label="กำลังโหลด…" />;

  const initials = member.full_name
    ? member.full_name.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('')
    : '?';

  return (
    <MobileAppShell title="" subtitle="">
      <div className="mobile-stack" style={{ paddingBottom: 16 }}>

        {/* Profile hero */}
        <div className="profile-card">
          <div className="profile-avatar">{initials}</div>
          <div>
            <p className="profile-name">{member.full_name}</p>
            <p className="profile-role">{ROLE_TH[effectiveRole ?? ''] ?? effectiveRole ?? 'สมาชิก'}</p>
            {member.phone && <p className="profile-phone">📞 {member.phone}</p>}
          </div>
        </div>

        {/* ข้อมูล */}
        <div className="kaona-card">
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>ข้อมูลสมาชิก</p>
          {[
            ['เลขบัตรประชาชน', member.citizen_id_masked ?? '—'],
            ['ที่อยู่', member.address ?? '—'],
            ['สถานะ', member.status === 'approved' ? '✅ อนุมัติแล้ว' : member.status],
          ].map(([label, value]) => (
            <div key={String(label)} className="info-row">
              <span className="info-row__label">{label}</span>
              <span className="info-row__value" style={{ maxWidth: '60%', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* สิทธิ์ */}
        {roles.length > 0 && (
          <div className="kaona-card">
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>สิทธิ์ของฉัน</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roles.map((r: string) => (
                <span key={r} style={{ padding: '6px 14px', borderRadius: 999, background: '#e8f5e9', color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>
                  {ROLE_TH[r] ?? r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* เมนูเพิ่มเติม */}
        <div className="kaona-card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { href: '/plots',           icon: '🌾', label: 'แปลงของฉัน',   show: ['farmer','leader'] },
            { href: '/planting-cycles', icon: '🌱', label: 'รอบเพาะปลูก',  show: ['farmer','leader'] },
            { href: '/no-burn',         icon: '🔥', label: 'ประวัติงดเผา', show: ['farmer','leader'] },
            { href: '/service',         icon: '🚛', label: 'งานขนส่ง',     show: ['truck_owner'] },
          ].filter(item => !effectiveRole || item.show.includes(effectiveRole)).map((item) => (
            <Link key={item.href} href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderBottom: '1px solid #f0f4f0', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{item.label}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 18 }}>›</span>
            </Link>
          ))}
          <button
            onClick={() => { if (window.confirm('ออกจากระบบ?')) window.location.reload(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', textAlign: 'left' }}>
            <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>🚪</span>
            <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>ออกจากระบบ</span>
          </button>
        </div>

      </div>
    </MobileAppShell>
  );
}
