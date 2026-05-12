'use client';

import { useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';

import { RegisterFormFarmer } from './register-form-farmer';
import { RegisterFormTruck } from './register-form-truck';
import { RegisterLinkPinForm } from './register-link-pin-form';
import { RegisterPending } from './register-pending';
import { RegisterPinSuccess } from './register-pin-success';

type TabKey = 'farmer' | 'truck' | 'pin';
type ViewState = 'tabs' | 'pending' | 'pin_success';

const TAB_CONFIG: { key: TabKey; label: string; icon: string; desc: string }[] = [
  { key: 'farmer',  label: 'สมาชิกเกษตรกร', icon: '🌾', desc: 'ลงทะเบียนแปลง รับเมล็ดพันธุ์ เข้าร่วมโครงการ' },
  { key: 'truck',   label: 'ทีมบริการ',      icon: '🚛', desc: 'ให้บริการขนส่งและงานภาคสนาม' },
  { key: 'pin',     label: 'มี PIN แล้ว',    icon: '🔑', desc: 'รับ PIN จากเจ้าหน้าที่ กดที่นี่เพื่อผูกบัญชี' },
];

export function RegisterTabs() {
  const { member } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('farmer');
  const [viewState, setViewState] = useState<ViewState>('tabs');
  const [successRole, setSuccessRole] = useState('');

  const lineUserId = member?.line_user_id;

  if (!lineUserId) {
    return <ErrorState title="ไม่พบข้อมูล LINE" detail="กรุณาปิดและเปิด Mini App ใหม่จาก LINE" />;
  }

  if (viewState === 'pending') {
    return <RegisterPending onReset={() => setViewState('tabs')} />;
  }

  if (viewState === 'pin_success') {
    return (
      <RegisterPinSuccess
        role={successRole}
        onDone={() => window.location.replace('/')}
      />
    );
  }

  return (
    <div className="mobile-stack">
      {/* Tab selector */}
      <div className="reg-tabs reg-tabs--3" role="tablist" aria-label="ประเภทการสมัคร">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={['reg-tab', activeTab === tab.key ? 'reg-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="reg-tab__icon">{tab.icon}</span>
            <span className="reg-tab__label">{tab.label}</span>
          </button>
        ))}
      </div>

      <p className="reg-tab-desc">
        {TAB_CONFIG.find((t) => t.key === activeTab)?.desc}
      </p>

      {activeTab === 'farmer' && (
        <RegisterFormFarmer lineUserId={lineUserId} onSubmitted={() => setViewState('pending')} />
      )}
      {activeTab === 'truck' && (
        <RegisterFormTruck lineUserId={lineUserId} onSubmitted={() => setViewState('pending')} />
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
