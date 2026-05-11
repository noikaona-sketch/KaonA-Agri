'use client';

import { useEffect, useMemo, useState } from 'react';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type RoleRequestType = 'service_team' | 'field_team' | 'field_assist' | 'backoffice_role';

type RoleRequest = {
  id: string;
  type: RoleRequestType;
  title: string;
  requesterName: string;
  phone: string;
  area: string;
  note?: string;
  status: ApprovalStatus;
  reviewerReason?: string;
  createdAt: string;
};

const STORAGE_KEY = 'kaona:role-requests:v1';

const typeLabel: Record<RoleRequestType, string> = {
  service_team: 'ลงทะเบียนทีมบริการ/ผู้ให้บริการ',
  field_team: 'คำขอบทบาททีมภาคสนาม',
  field_assist: 'งานช่วยลงทะเบียนสมาชิก/บริการ',
  backoffice_role: 'คำขอบทบาทหลังบ้าน',
};

function useRoleRequests() {
  const [items, setItems] = useState<RoleRequest[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setItems(JSON.parse(raw) as RoleRequest[]);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function submit(payload: Omit<RoleRequest, 'id' | 'status' | 'createdAt'>) {
    const next: RoleRequest = { ...payload, id: `REQ-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
    setItems((prev) => [next, ...prev]);
  }

  function review(id: string, status: ApprovalStatus, reviewerReason?: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status, reviewerReason } : item)));
  }

  return { items, submit, review };
}

function statusToChip(status: ApprovalStatus): 'submitted' | 'approved' | 'rejected' {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'submitted';
}

export function RegistrationRequestForm({ title, subtitle, type }: { title: string; subtitle: string; type: RoleRequestType }) {
  const { items, submit } = useRoleRequests();
  const [requesterName, setRequesterName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');

  const ownItems = useMemo(() => items.filter((item) => item.type === type), [items, type]);

  return (
    <MobileAppShell title={title} subtitle={subtitle}>
      <section className="mobile-stack">
        <article className="kaona-card">
          <h2 className="kaona-card__title">แบบฟอร์มส่งคำขอ</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="ชื่อ-นามสกุล" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
            <input placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input placeholder="พื้นที่รับผิดชอบ" value={area} onChange={(e) => setArea(e.target.value)} />
            <textarea rows={3} placeholder="หมายเหตุ/เหตุผล" value={note} onChange={(e) => setNote(e.target.value)} />
            <UIButton
              onClick={() => {
                if (!requesterName || !phone || !area) return;
                submit({ title, requesterName, phone, area, note: note || undefined, type });
                setRequesterName('');
                setPhone('');
                setArea('');
                setNote('');
              }}
            >
              ส่งคำขอ
            </UIButton>
          </div>
        </article>

        <article className="kaona-card">
          <h3 className="kaona-card__title">สถานะคำขอของฉัน</h3>
          {ownItems.length === 0 ? <p className="kaona-card__body">ยังไม่มีคำขอ</p> : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {ownItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{typeLabel[item.type]}</p>
                <p style={{ margin: '4px 0' }}>เลขอ้างอิง: {item.id}</p>
                <StatusChip status={statusToChip(item.status)} />
                {item.reviewerReason ? <p style={{ margin: '6px 0 0' }}>เหตุผลจากผู้ตรวจ: {item.reviewerReason}</p> : null}
              </div>
            ))}
          </div>
        </article>
      </section>
    </MobileAppShell>
  );
}

export function ApprovalsQueuePage() {
  const { items, review } = useRoleRequests();
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <MobileAppShell title="คิวอนุมัติคำขอบทบาท" subtitle="ต้นแบบอนุมัติ/ไม่อนุมัติ พร้อมเหตุผล" roleBadge="แอดมิน">
      <section className="mobile-stack">
        <article className="kaona-card">
          <h2 className="kaona-card__title">รายการรอพิจารณา</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.length === 0 ? <p className="kaona-card__body">ยังไม่มีคำขอในคิว</p> : null}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} style={{ textAlign: 'left', border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{item.title}</p>
                <p style={{ margin: '4px 0' }}>{item.requesterName} · {typeLabel[item.type]}</p>
                <StatusChip status={statusToChip(item.status)} />
              </button>
            ))}
          </div>
        </article>

        {selected ? (
          <article className="kaona-card">
            <h3 className="kaona-card__title">พิจารณาคำขอ {selected.id}</h3>
            <textarea rows={3} placeholder="ระบุเหตุผลประกอบการอนุมัติ/ปฏิเสธ" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <UIButton onClick={() => review(selected.id, 'approved', reason || undefined)}>อนุมัติ</UIButton>
              <UIButton variant="secondary" onClick={() => review(selected.id, 'rejected', reason || undefined)}>ปฏิเสธ</UIButton>
            </div>
          </article>
        ) : null}
      </section>
    </MobileAppShell>
  );
}
