'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { FarmerWizard } from '@/features/register-farmer/farmer-wizard';
import { TruckWizard } from '@/features/register-truck/truck-wizard';
import { ErrorState } from '@/shared/components/error-state';

import { RegisterLinkPinForm } from './register-link-pin-form';
import { RegisterPending } from './register-pending';
import { RegisterPinSuccess } from './register-pin-success';

type TabKey = 'farmer' | 'truck' | 'pin';
type ViewState = 'choose' | 'form' | 'pending' | 'pin_success';

const OPTIONS: { key: TabKey; icon: string; label: string; desc: string; color: string; border: string }[] = [
  {
    key: 'farmer',
    icon: '🌾',
    label: 'สมาชิกเกษตรกร',
    desc: 'ลงทะเบียนแปลง รับเมล็ดพันธุ์\nเข้าร่วมโครงการ KaonA',
    color: '#e8f5e9',
    border: '#2e7d32',
  },
  {
    key: 'truck',
    icon: '🚛',
    label: 'ทีมรถร่วม / บริการ',
    desc: 'ให้บริการรถเกี่ยว ขนส่ง\nและงานภาคสนาม',
    color: '#e3f2fd',
    border: '#1565c0',
  },
  {
    key: 'pin',
    icon: '🔑',
    label: 'มี PIN แล้ว',
    desc: 'รับ PIN จากเจ้าหน้าที่\nกดที่นี่เพื่อผูกบัญชี LINE',
    color: '#fff8e1',
    border: '#f9a825',
  },
];

export function RegisterTabs() {
  const { member } = useAuth();
  const params = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [viewState, setViewState] = useState<ViewState>('choose');
  const [successRole, setSuccessRole] = useState('');

  // อ่าน ?tab=pin จาก URL → เปิด form ทันที
  useEffect(() => {
    const tab = params.get('tab');
    if (tab === 'pin') { setActiveTab('pin'); setViewState('form'); }
  }, [params]);

  const lineUserId = member?.line_user_id ?? 'dev-mock-line-id';

  if (!lineUserId && !member) {
    return <ErrorState title="ไม่พบข้อมูล LINE" detail="กรุณาปิดและเปิด Mini App ใหม่จาก LINE" />;
  }

  if (viewState === 'pending') return <RegisterPending onReset={() => { setViewState('choose'); setActiveTab(null); }} />;
  if (viewState === 'pin_success') {
    return <RegisterPinSuccess role={successRole} onDone={() => window.location.replace('/')} />;
  }

  // หน้าเลือกประเภท
  if (viewState === 'choose' || !activeTab) {
    return (
      <div className="mobile-stack">
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            เลือกประเภทที่ต้องการสมัคร
          </p>
        </div>

        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setActiveTab(opt.key); setViewState('form'); }}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: opt.color,
              border: `2px solid ${opt.border}`,
              borderRadius: 18, padding: '20px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f1c' }}>{opt.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4e5a53', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{opt.desc}</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 22, color: opt.border, flexShrink: 0 }}>›</span>
          </button>
        ))}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>
          หากไม่แน่ใจ ติดต่อเจ้าหน้าที่ KaonA
        </p>
      </div>
    );
  }

  // หน้า form ที่เลือก
  return (
    <div className="mobile-stack">
      {/* back button */}
      <button
        onClick={() => { setActiveTab(null); setViewState('choose'); }}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 15, padding: 0, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }}>
        ← กลับ
      </button>

      {/* header การ์ดเล็ก */}
      {(() => {
        const opt = OPTIONS.find((o) => o.key === activeTab)!;
        return (
          <div style={{ background: opt.color, border: `1.5px solid ${opt.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 28 }}>{opt.icon}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{opt.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{opt.desc.split('\n')[0]}</p>
            </div>
          </div>
        );
      })()}

      {activeTab === 'farmer' && (
        <FarmerWizard lineUserId={lineUserId} onSubmitted={() => setViewState('pending')} />
      )}
      {activeTab === 'truck' && (
        <TruckWizard lineUserId={lineUserId} onSubmitted={() => setViewState('pending')} />
      )}
      {activeTab === 'pin' && (
        <RegisterLinkPinForm
          lineUserId={lineUserId}
          onSuccess={(role) => { setSuccessRole(role); setViewState('pin_success'); }}
        />
      )}
    </div>
  );
}
