'use client';

import { useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';

import { RegisterFormFarmer } from './register-form-farmer';
import { RegisterFormTruck } from './register-form-truck';
import { RegisterPending } from './register-pending';

type TabKey = 'farmer' | 'truck';

const TAB_CONFIG: { key: TabKey; label: string; icon: string; desc: string }[] = [
  { key: 'farmer', label: 'สมาชิกเกษตรกร', icon: '🌾', desc: 'ลงทะเบียนแปลง รับเมล็ดพันธุ์ เข้าร่วมโครงการ' },
  { key: 'truck', label: 'ทีมบริการ', icon: '🚛', desc: 'ให้บริการขนส่งและงานภาคสนาม' },
];

export function RegisterTabs() {
  const { member } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('farmer');
  const [submitted, setSubmitted] = useState(false);

  const lineUserId = member?.line_user_id;

  if (!lineUserId) {
    return <ErrorState title="ไม่พบข้อมูล LINE" detail="กรุณาปิดและเปิด Mini App ใหม่จาก LINE" />;
  }

  if (submitted) {
    return <RegisterPending onReset={() => setSubmitted(false)} />;
  }

  return (
    <div className="mobile-stack">
      {/* Tab selector */}
      <div className="reg-tabs" role="tablist" aria-label="ประเภทการสมัคร">
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

      {/* Tab description */}
      <p className="reg-tab-desc">
        {TAB_CONFIG.find((t) => t.key === activeTab)?.desc}
      </p>

      {/* Form */}
      {activeTab === 'farmer' && (
        <RegisterFormFarmer lineUserId={lineUserId} onSubmitted={() => setSubmitted(true)} />
      )}
      {activeTab === 'truck' && (
        <RegisterFormTruck lineUserId={lineUserId} onSubmitted={() => setSubmitted(true)} />
      )}
    </div>
  );
}
