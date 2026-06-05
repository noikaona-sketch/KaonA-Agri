'use client';

import { useEffect, useMemo, useState } from 'react';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type RoleRequestType = 'service_team' | 'field_team' | 'field_assist' | 'backoffice_role';
type ServiceType = 'รถไถ' | 'รถเกี่ยว' | 'รถขนส่ง';
type AssistTarget = 'member_onboarding' | 'service_team_onboarding';

type RoleRequest = {
  id: string;
  type: RoleRequestType;
  title: string;
  requesterName: string;
  phone: string;
  area: string;
  note?: string;
  serviceType?: ServiceType;
  providerTeamName?: string;
  equipmentSummary?: string;
  availabilityNote?: string;
  assistTarget?: AssistTarget;
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

const assistTargetLabel: Record<AssistTarget, string> = {
  member_onboarding: 'ช่วยลงทะเบียนสมาชิก',
  service_team_onboarding: 'ช่วยลงทะเบียนทีมบริการ',
};

function useRoleRequests(type: RoleRequestType) {
  const [items, setItems] = useState<RoleRequest[]>([]);
  function getCachedMemberId() {
    try {
      const raw = sessionStorage.getItem('kaona_auth_cache');
      if (!raw) return '';
      const parsed = JSON.parse(raw) as { member?: { member_id?: string } };
      return parsed.member?.member_id ?? '';
    } catch {
      return '';
    }
  }

  async function reload() {
    if (type !== 'service_team' && type !== 'field_team') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return setItems([]);
      try { setItems((JSON.parse(raw) as RoleRequest[]).filter((i) => i.type === type)); } catch { setItems([]); }
      return;
    }

    const supabase = tryCreateSupabaseBrowserClient();
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const token = session?.access_token;
    if (!token) return setItems([]);
    const res = await fetch(`/api/member/provider-requests?requestType=${type}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await res.json()) as { items?: Array<Record<string, unknown>> };
    if (!res.ok) return setItems([]);
    const mapped = (payload.items ?? []).map((row) => ({
      id: String(row.id),
      type: String(row.request_type ?? type) as RoleRequestType,
      title: String(row.title ?? ''),
      requesterName: String(row.requester_name ?? ''),
      phone: String(row.phone ?? ''),
      area: String(row.area ?? ''),
      note: (row.note as string | null) ?? undefined,
      serviceType: (row.service_type as ServiceType | null) ?? undefined,
      providerTeamName: (row.provider_team_name as string | null) ?? undefined,
      equipmentSummary: (row.equipment_summary as string | null) ?? undefined,
      availabilityNote: (row.availability_note as string | null) ?? undefined,
      status: String(row.status ?? 'pending') as ApprovalStatus,
      reviewerReason: (row.reviewer_reason as string | null) ?? undefined,
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
    setItems(mapped);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void reload();
  }, [type]);

  async function submit(payload: Omit<RoleRequest, 'id' | 'status' | 'createdAt'>) {
    if (type !== 'service_team' && type !== 'field_team') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as RoleRequest[]) : [];
      const next: RoleRequest = { ...payload, id: `REQ-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
      const merged = [next, ...current];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      setItems(merged.filter((i) => i.type === type));
      return;
    }

    const supabase = tryCreateSupabaseBrowserClient();
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const token = session?.access_token;
    if (!token) return;
    await fetch('/api/member/provider-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: payload.title,
        requesterName: payload.requesterName,
        phone: payload.phone,
        area: payload.area,
        note: payload.note,
        serviceType: payload.serviceType,
        providerTeamName: payload.providerTeamName,
        equipmentSummary: payload.equipmentSummary,
        availabilityNote: payload.availabilityNote,
        requestType: type,
      }),
    });
    await reload();
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
  const { items, submit } = useRoleRequests(type);
  const [requesterName, setRequesterName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('รถไถ');
  const [providerTeamName, setProviderTeamName] = useState('');
  const [equipmentSummary, setEquipmentSummary] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [assistTarget, setAssistTarget] = useState<AssistTarget>('member_onboarding');

  const ownItems = useMemo(() => items.filter((item) => item.type === type), [items, type]);
  const isServiceRegister = type === 'service_team';
  const isDbBackedRegister = type === 'service_team' || type === 'field_team';
  const isAssistRegister = type === 'field_assist';

  return (
    <MobileAppShell title={title} subtitle={subtitle}>
      <section className="mobile-stack">
        <article className="kaona-card">
          <h2 className="kaona-card__title">ส่งคำขอรออนุมัติบทบาท</h2>
          <p className="kaona-card__body">{isDbBackedRegister ? 'บันทึกคำขอเข้าคิวอนุมัติในระบบกลาง' : 'MVP/Local: ข้อมูลหน้านี้เก็บใน localStorage ของเครื่องนี้เท่านั้น'}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {isServiceRegister ? (
              <>
                <label>
                  ประเภทบริการ
                  <select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
                    <option value="รถไถ">รถไถ</option>
                    <option value="รถเกี่ยว">รถเกี่ยว</option>
                    <option value="รถขนส่ง">รถขนส่ง</option>
                  </select>
                </label>
                <input placeholder="ชื่อผู้ให้บริการ/ทีม" value={providerTeamName} onChange={(e) => setProviderTeamName(e.target.value)} />
              </>
            ) : null}

            {isAssistRegister ? (
              <label>
                ประเภทงานช่วยลงทะเบียน
                <select value={assistTarget} onChange={(e) => setAssistTarget(e.target.value as AssistTarget)}>
                  <option value="member_onboarding">ช่วยสมัครสมาชิกใหม่</option>
                  <option value="service_team_onboarding">ช่วยสมัครทีมบริการ</option>
                </select>
              </label>
            ) : null}

            <input placeholder={isServiceRegister ? 'ช่องทางติดต่อ (โทรศัพท์หรือ LINE)' : 'เบอร์โทร/LINE'} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input placeholder={isServiceRegister ? 'พื้นที่ให้บริการ' : 'พื้นที่รับผิดชอบ'} value={area} onChange={(e) => setArea(e.target.value)} />
            <input placeholder="ชื่อ-นามสกุลผู้ยื่นคำขอ" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />

            {isServiceRegister ? <textarea rows={3} placeholder="สรุปรถ/อุปกรณ์" value={equipmentSummary} onChange={(e) => setEquipmentSummary(e.target.value)} /> : null}
            {isServiceRegister ? <input placeholder="ช่วงเวลาพร้อมให้บริการ (เช่น จ.-ส. 08:00-18:00)" value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} /> : null}

            <textarea rows={3} placeholder="หมายเหตุ/เหตุผล" value={note} onChange={(e) => setNote(e.target.value)} />
            <UIButton
              onClick={() => {
                if (!requesterName || !phone || !area) return;
                if (isServiceRegister && (!providerTeamName || !equipmentSummary)) return;
                submit({
                  title,
                  requesterName,
                  phone,
                  area,
                  note: note || undefined,
                  type,
                  serviceType: isServiceRegister ? serviceType : undefined,
                  providerTeamName: isServiceRegister ? providerTeamName : undefined,
                  equipmentSummary: isServiceRegister ? equipmentSummary : undefined,
                  availabilityNote: isServiceRegister ? availabilityNote || undefined : undefined,
                  assistTarget: isAssistRegister ? assistTarget : undefined,
                });
                setRequesterName('');
                setPhone('');
                setArea('');
                setNote('');
                setProviderTeamName('');
                setEquipmentSummary('');
                setAvailabilityNote('');
              }}
            >
              ส่งคำขอ
            </UIButton>
          </div>
        </article>

        <article className="kaona-card">
          <h3 className="kaona-card__title">คำขอของฉัน</h3>
          {ownItems.length === 0 ? <p className="kaona-card__body">ยังไม่มีคำขอ</p> : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {ownItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{typeLabel[item.type]}</p>
                <p style={{ margin: '4px 0' }}>เลขอ้างอิง: {item.id}</p>
                {item.serviceType ? <p style={{ margin: '4px 0' }}>ประเภทบริการ: {item.serviceType}</p> : null}
                {item.providerTeamName ? <p style={{ margin: '4px 0' }}>ผู้ให้บริการ/ทีม: {item.providerTeamName}</p> : null}
                {item.assistTarget ? <p style={{ margin: '4px 0' }}>งานช่วยลงทะเบียน: {assistTargetLabel[item.assistTarget]}</p> : null}
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

export function ApprovalsQueueContent() {
  const [items, setItems] = useState<RoleRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    async function loadQueue() {
      const res = await fetch('/api/admin/provider-requests?status=pending', { credentials: 'include' });
      const payload = (await res.json()) as { items?: Array<Record<string, unknown>> };
      if (!res.ok) return setItems([]);
      setItems((payload.items ?? []).map((row) => ({
        id: String(row.id),
        type: 'service_team',
        title: String(row.title ?? ''),
        requesterName: String(row.requester_name ?? ''),
        phone: String(row.phone ?? ''),
        area: String(row.area ?? ''),
        note: (row.note as string | null) ?? undefined,
        serviceType: (row.service_type as ServiceType | null) ?? undefined,
        providerTeamName: (row.provider_team_name as string | null) ?? undefined,
        equipmentSummary: (row.equipment_summary as string | null) ?? undefined,
        availabilityNote: (row.availability_note as string | null) ?? undefined,
        status: String(row.status ?? 'pending') as ApprovalStatus,
        reviewerReason: (row.reviewer_reason as string | null) ?? undefined,
        createdAt: String(row.created_at ?? new Date().toISOString()),
      })));
    }
    void loadQueue();
  }, []);

  return (
    <section className="mobile-stack">
        <article className="kaona-card">
          <h2 className="kaona-card__title">รายการรออนุมัติ</h2>
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
            <textarea rows={3} placeholder="เหตุผล (ถ้ามี)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <UIButton onClick={async () => {
                await fetch('/api/admin/provider-requests/review', { credentials: 'include',  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: selected.id, decision: 'approved', reason: reason || undefined }) });
                setItems((prev) => prev.filter((p) => p.id !== selected.id));
                setSelectedId('');
                setReason('');
              }}>อนุมัติ</UIButton>
              <UIButton variant="secondary" onClick={async () => {
                await fetch('/api/admin/provider-requests/review', { credentials: 'include',  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: selected.id, decision: 'rejected', reason: reason || undefined }) });
                setItems((prev) => prev.filter((p) => p.id !== selected.id));
                setSelectedId('');
                setReason('');
              }}>ไม่อนุมัติ</UIButton>
            </div>
          </article>
        ) : null}
      </section>
  );
}

export function ApprovalsQueuePage() {
  return (
    <MobileAppShell title="คิวอนุมัติคำขอบทบาท" subtitle="MVP/Local: อนุมัติคำขอจากข้อมูลในเครื่องนี้" roleBadge="แอดมิน">
      <ApprovalsQueueContent />
    </MobileAppShell>
  );
}

