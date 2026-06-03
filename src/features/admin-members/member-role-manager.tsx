'use client';

import { useState } from 'react';

type RoleRow = { role: string; is_primary: boolean };

const ALL_ROLES = ['farmer', 'truck_owner', 'inspector', 'staff', 'leader', 'admin'] as const;
type AppRole = (typeof ALL_ROLES)[number];

const ROLE_CONFIG: Record<AppRole, { icon: string; label: string; color: string; border: string }> = {
  farmer:      { icon: '🌾', label: 'สมาชิกเกษตรกร',   color: '#e8f5e9', border: '#a5d6a7' },
  truck_owner: { icon: '🚛', label: 'ทีมบริการ',        color: '#fff3e0', border: '#ffcc80' },
  inspector:   { icon: '🔍', label: 'ผู้ตรวจสอบภาคสนาม', color: '#e3f2fd', border: '#90caf9' },
  staff:       { icon: '👷', label: 'พนักงาน',         color: '#f3e5f5', border: '#ce93d8' },
  leader:      { icon: '👥', label: 'หัวหน้ากลุ่ม',    color: '#e0f2f1', border: '#80cbc4' },
  admin:       { icon: '⚙️', label: 'แอดมิน',          color: '#fce4ec', border: '#f48fb1' },
};

type MemberRoleManagerProps = {
  memberId: string;
  memberName: string;
  currentRoles: RoleRow[];
  onRolesUpdated: () => void;
};

export function MemberRoleManager({ memberId, memberName, currentRoles, onRolesUpdated }: MemberRoleManagerProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const roleNames = currentRoles.map((r) => r.role);

  async function callRoleApi(action: 'add' | 'remove' | 'set_primary', role: string) {
    const res = await fetch(`/api/admin/members/${memberId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, role }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) throw new Error(payload.error ?? 'ดำเนินการไม่สำเร็จ');
  }

  async function addRole(role: AppRole, setPrimary = false) {
    setActing(`add-${role}`); setNotice(null);
    try {
      await callRoleApi('add', role);
      if (setPrimary) await callRoleApi('set_primary', role);
      setNotice({ type: 'ok', msg: `เพิ่มสิทธิ์ ${ROLE_CONFIG[role].icon} ${ROLE_CONFIG[role].label} แล้ว` });
      onRolesUpdated();
    } catch (e) {
      setNotice({ type: 'err', msg: String(e) });
    }
    setActing(null);
  }

  async function removeRole(role: string) {
    if (!window.confirm(`ลบสิทธิ์ "${role}" จาก ${memberName}?`)) return;
    setActing(`remove-${role}`); setNotice(null);
    try {
      await callRoleApi('remove', role);
      setNotice({ type: 'ok', msg: `ลบสิทธิ์ ${role} แล้ว` });
      onRolesUpdated();
    } catch (e) {
      setNotice({ type: 'err', msg: String(e) });
    }
    setActing(null);
  }

  async function setPrimary(role: string) {
    setActing(`primary-${role}`);
    try {
      await callRoleApi('set_primary', role);
      setNotice({ type: 'ok', msg: `ตั้ง ${role} เป็นสิทธิ์หลักแล้ว` });
      onRolesUpdated();
    } catch (e) {
      setNotice({ type: 'err', msg: String(e) });
    }
    setActing(null);
  }

  const addableRoles = ALL_ROLES.filter((r) => !roleNames.includes(r));

  return (
    <section>
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>
        🏷️ จัดการสิทธิ์
      </h2>

      {notice && (
        <div style={{ background: notice.type === 'ok' ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, fontWeight: 600, color: notice.type === 'ok' ? '#1b5e20' : '#c62828' }}>
          {notice.type === 'ok' ? '✅' : '⚠️'} {notice.msg}
        </div>
      )}

      {/* สิทธิ์ที่มีอยู่ */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#4a6741' }}>สิทธิ์ปัจจุบัน</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {currentRoles.map((r) => {
            const cfg = ROLE_CONFIG[r.role as AppRole];
            return (
              <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 0, background: cfg?.color ?? '#f5f5f5', border: `1.5px solid ${cfg?.border ?? '#e0e0e0'}`, borderRadius: 10, overflow: 'hidden' }}>
                <span style={{ padding: '8px 10px 8px 12px', fontSize: 14, fontWeight: 700, color: '#1a1f1c' }}>
                  {cfg?.icon} {cfg?.label ?? r.role}
                  {r.is_primary && <span style={{ marginLeft: 4, fontSize: 11, background: '#fff', borderRadius: 4, padding: '1px 4px', color: '#2e7d32', fontWeight: 700 }}>หลัก</span>}
                </span>
                <div style={{ display: 'flex', borderLeft: `1px solid ${cfg?.border ?? '#e0e0e0'}` }}>
                  {!r.is_primary && (
                    <button
                      onClick={() => setPrimary(r.role)}
                      disabled={acting !== null}
                      title="ตั้งเป็นสิทธิ์หลัก"
                      style={{ padding: '8px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#2e7d32' }}
                    >★</button>
                  )}
                  <button
                    onClick={() => removeRole(r.role)}
                    disabled={acting !== null || currentRoles.length <= 1}
                    title="ลบสิทธิ์นี้"
                    style={{ padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#c62828' }}
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ปุ่มลัด */}
      {(addableRoles.includes('inspector') || addableRoles.includes('leader') || addableRoles.includes('staff')) && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#4a6741' }}>เพิ่มสิทธิ์พิเศษ</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {addableRoles.includes('inspector') && (
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => addRole('inspector')}
                disabled={acting !== null}
                style={{ borderColor: '#90caf9', color: '#1565c0', background: '#e3f2fd' }}
              >
                {acting === 'add-inspector' ? '…' : '🔍 เพิ่มเป็นผู้ตรวจสอบ'}
              </button>
            )}
            {addableRoles.includes('leader') && (
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => addRole('leader')}
                disabled={acting !== null}
                style={{ borderColor: '#80cbc4', color: '#00695c', background: '#e0f2f1' }}
              >
                {acting === 'add-leader' ? '…' : '👥 เพิ่มเป็นหัวหน้ากลุ่ม'}
              </button>
            )}
            {addableRoles.includes('staff') && (
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => addRole('staff')}
                disabled={acting !== null}
                style={{ borderColor: '#ce93d8', color: '#6a1b9a', background: '#f3e5f5' }}
              >
                {acting === 'add-staff' ? '…' : '👷 เพิ่มเป็นพนักงาน'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* เพิ่ม role อื่น */}
      {addableRoles.filter((r) => !['inspector', 'leader', 'staff'].includes(r)).length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#4a6741' }}>เพิ่ม role อื่น</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {addableRoles.filter((r) => !['inspector', 'leader', 'staff'].includes(r)).map((role) => {
              const cfg = ROLE_CONFIG[role];
              return (
                <button
                  key={role}
                  className="admin-btn admin-btn--secondary"
                  onClick={() => addRole(role)}
                  disabled={acting !== null}
                  style={{ borderColor: cfg.border, color: '#333', background: cfg.color }}
                >
                  {acting === `add-${role}` ? '…' : `${cfg.icon} ${cfg.label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
