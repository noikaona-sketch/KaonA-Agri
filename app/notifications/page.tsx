'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentMember, useCurrentRoles, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import type { AppRole } from '@/shared/auth/auth-types';

// ─── Types ────────────────────────────────────────────────────────────────────
type Task = {
  id:       string;
  icon:     string;
  label:    string;
  desc:     string;
  href:     string;
  urgency:  'high' | 'normal';
  group:    'today' | 'waiting' | 'work';
};

type Notif = {
  id: string; title: string; body: string;
  read_at: string | null; created_at: string;
  related_resource_type: string | null; related_resource_id: string | null;
};

type Price = { price_per_kg: number; crop_type: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', overflow: 'hidden' as const },
  sectionLabel: { fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500 as const, letterSpacing: '.04em', margin: '0 0 8px' },
};

function TaskCard({ task }: { task: Task }) {
  return (
    <Link href={task.href} style={{ textDecoration: 'none' }}>
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderLeft: `3px solid ${task.urgency === 'high' ? '#DC2626' : '#3B6D11'}` }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{task.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{task.label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>{task.desc}</p>
        </div>
        <span style={{ color: 'var(--color-text-secondary,#888)', fontSize: 18, flexShrink: 0 }}>›</span>
      </div>
    </Link>
  );
}

function Section({ label, tasks }: { label: string; tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <p style={S.sectionLabel}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const member      = useCurrentMember();
  const roles       = useCurrentRoles() as AppRole[];
  const effectiveRole = useEffectiveRole();
  const memberId    = member?.member_id ?? '';

  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [price,    setPrice]    = useState<Price | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [unread,   setUnread]   = useState(0);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    const s = createSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);

    void Promise.all([
      // pending cycles (due planting rounds)
      s.from('planting_cycles').select('id,status,field_name').eq('member_id', memberId).in('status', ['registered','approved']).limit(5),
      // pending reservations
      s.from('seed_reservations').select('id,reservation_no,status').eq('member_id', memberId).in('status', ['pending','confirmed']).limit(5),
      // no-burn submissions pending
      s.from('no_burn_submissions').select('id,status').eq('member_id', memberId).in('status', ['pending','submitted']).limit(3),
      // plots without village
      s.from('plots').select('id,village').eq('member_id', memberId).is('deleted_at', null).limit(5),
      // member approval status
      s.from('members').select('status,phone,citizen_id_masked,address,bank_account_number').eq('id', memberId).maybeSingle(),
      // notifications
      s.from('notifications').select('id,title,body,read_at,created_at,related_resource_type,related_resource_id').eq('member_id', memberId).order('created_at', { ascending: false }).limit(30),
      // price
      s.from('market_prices').select('price_per_kg,crop_type').eq('is_active', true).ilike('crop_type', '%ข้าวโพด%').order('effective_date', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([cycles, reservations, noburn, plots, memberData, notifData, priceData]) => {
      const built: Task[] = [];
      const m = memberData.data as Record<string, string | null> | null;

      // ── Today/Due tasks ────────────────────────────────────────────────
      if (m) {
        const missingFields = !m.phone || !m.citizen_id_masked || !m.address || !m.bank_account_number;
        if (missingFields) {
          built.push({ id: 'profile-incomplete', icon: '📋', label: 'ข้อมูลสมาชิกไม่ครบ', desc: 'กรุณากรอกข้อมูลให้ครบ เพื่อรับสิทธิ์เต็มที่', href: '/profile/edit', urgency: 'high', group: 'today' });
        }
      }

      (cycles.data ?? []).forEach((c) => {
        const cd = c as { id: string; status: string; field_name: string | null };
        if (cd.status === 'registered') {
          built.push({ id: `cycle-${cd.id}`, icon: '🌱', label: 'รอบปลูกรอยืนยัน', desc: cd.field_name ?? 'กดเพื่อดูรายละเอียด', href: `/planting-cycles/${cd.id}`, urgency: 'high', group: 'today' });
        }
      });

      // ── Waiting tasks ──────────────────────────────────────────────────
      (reservations.data ?? []).forEach((r) => {
        const rd = r as { id: string; reservation_no: string; status: string };
        built.push({ id: `res-${rd.id}`, icon: '🌽', label: rd.status === 'pending' ? 'การจองรออนุมัติ' : 'จองยืนยันแล้ว รอรับสินค้า', desc: rd.reservation_no, href: '/service/reservations', urgency: rd.status === 'pending' ? 'high' : 'normal', group: rd.status === 'pending' ? 'waiting' : 'waiting' });
      });

      (noburn.data ?? []).forEach((nb) => {
        const nd = nb as { id: string; status: string };
        built.push({ id: `noburn-${nd.id}`, icon: '🌿', label: 'คำขอไม่เผารอผล', desc: 'รอเจ้าหน้าที่ตรวจสอบ', href: '/no-burn', urgency: 'normal', group: 'waiting' });
      });

      const incompletePlots = (plots.data ?? []).filter((p) => !(p as { village: string | null }).village);
      if (incompletePlots.length > 0) {
        built.push({ id: 'plots-incomplete', icon: '📍', label: `แปลง ${incompletePlots.length} แปลง ข้อมูลไม่ครบ`, desc: 'กรอกข้อมูลตำแหน่งให้ครบ', href: '/plots', urgency: 'normal', group: 'waiting' });
      }

      // ── Role-specific work tasks ────────────────────────────────────────
      if (roles.includes('inspector' as AppRole)) {
        built.push({ id: 'inspector-tasks', icon: '🔍', label: 'งานตรวจที่ได้รับมอบหมาย', desc: 'ดูรายการและบันทึกผล', href: '/inspection/tasks', urgency: 'normal', group: 'work' });
      }
      if (roles.includes('leader' as AppRole)) {
        built.push({ id: 'leader-team', icon: '👥', label: 'ติดตามสถานะลูกทีม', desc: 'ดูรายชื่อและรอบปลูกของทีม', href: '/team', urgency: 'normal', group: 'work' });
        built.push({ id: 'leader-register', icon: '👤', label: 'ช่วยสมัครสมาชิก', desc: 'สมัครสมาชิกแทนลูกทีม', href: '/field/assist-registration', urgency: 'normal', group: 'work' });
      }
      if (roles.includes('staff' as AppRole)) {
        built.push({ id: 'staff-field', icon: '🌽', label: 'จองเมล็ดให้สมาชิก', desc: 'เปิดหน้าจองภาคสนาม', href: '/field#reservation', urgency: 'normal', group: 'work' });
        built.push({ id: 'staff-queue', icon: '📋', label: 'คิวจองรออนุมัติ', desc: 'ดูรายการจองที่รอยืนยัน', href: '/admin/sales', urgency: 'normal', group: 'work' });
      }
      if (roles.includes('truck_owner' as AppRole)) {
        built.push({ id: 'truck-jobs', icon: '🚜', label: 'งานรถวันนี้', desc: 'ดูรายการงานที่ได้รับ', href: '/truck', urgency: 'normal', group: 'work' });
      }

      setTasks(built);
      const notifList = (notifData.data ?? []) as Notif[];
      setNotifs(notifList);
      setUnread(notifList.filter((n) => !n.read_at).length);
      if (priceData.data) setPrice(priceData.data as Price);
      setLoading(false);
    });
  }, [memberId, roles]);

  async function markAllRead() {
    const s = createSupabaseBrowserClient();
    await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('member_id', memberId).is('read_at', null);
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  const todayTasks   = tasks.filter((t) => t.group === 'today');
  const waitingTasks = tasks.filter((t) => t.group === 'waiting');
  const workTasks    = tasks.filter((t) => t.group === 'work');
  const hasNoTasks   = tasks.length === 0;

  return (
    <ProtectedRoute>
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>งานของฉัน</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          {unread > 0 && (
            <div style={{ background: '#EAF3DE', border: '0.5px solid #A3C78A', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, color: '#3B6D11' }}>
              {unread} ยังไม่ได้อ่าน
            </div>
          )}
        </div>

        {/* ราคาข้าวโพดวันนี้ */}
        {price && (
          <div style={{ ...S.card, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🌽</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>ราคา{price.crop_type}วันนี้</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#3B6D11' }}>{price.price_per_kg.toLocaleString()} บาท/ตัน</p>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>เกรด A</span>
          </div>
        )}

        {loading && <LoadingState label="กำลังโหลด…" />}

        {!loading && hasNoTasks && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary,#888)' }}>
            <p style={{ fontSize: 40, margin: '0 0 8px' }}>✅</p>
            <p style={{ fontSize: 14 }}>ไม่มีงานค้างอยู่</p>
          </div>
        )}

        {/* Today */}
        {todayTasks.length > 0 && (
          <Section label="🔴 วันนี้ / ด่วน" tasks={todayTasks} />
        )}

        {/* Waiting */}
        {waitingTasks.length > 0 && (
          <Section label="⏳ รออยู่" tasks={waitingTasks} />
        )}

        {/* Work */}
        {workTasks.length > 0 && (
          <Section label="📋 งานที่ได้รับมอบหมาย" tasks={workTasks} />
        )}

        {/* Announcements */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ ...S.sectionLabel, margin: 0 }}>📢 ประกาศและข่าวสาร</p>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                อ่านทั้งหมด
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ ...S.card, padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary,#888)', fontSize: 13 }}>
              ยังไม่มีประกาศใหม่
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifs.slice(0, 10).map((n) => {
                const isUnread = !n.read_at;
                return (
                  <div key={n.id} style={{ ...S.card, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', background: isUnread ? 'var(--color-background-secondary,#f9fafb)' : 'var(--color-background-primary,#fff)' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{isUnread ? '🔔' : '🔕'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: isUnread ? 500 : 400, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{n.title}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)', lineHeight: 1.5 }}>{n.body}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>
                        {new Date(n.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isUnread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B6D11', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </MobileAppShell>
    </ProtectedRoute>
  );
}
