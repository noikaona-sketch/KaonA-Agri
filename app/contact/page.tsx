'use client';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';

const FEATURES = [
  { icon: '🌽', title: 'เมล็ดพันธุ์คุณภาพ',  desc: 'คัดสรรเมล็ดพันธุ์ข้าวโพดคุณภาพสูง ราคาเป็นธรรม' },
  { icon: '🚜', title: 'บริการรถเกี่ยว',       desc: 'ทีมรถเกี่ยวมืออาชีพ ตรงเวลา ราคาโปร่งใส' },
  { icon: '📊', title: 'ติดตามผลผลิต',          desc: 'บันทึกและติดตามการเพาะปลูกแบบ real-time' },
  { icon: '💳', title: 'สินเชื่อเกษตรกร',       desc: 'ระบบเครดิตยืดหยุ่น เพื่อสมาชิก KaonA' },
];

const CONTACTS = [
  { icon: '📞', label: 'โทรศัพท์',    value: '089-XXX-XXXX',    href: 'tel:089XXXXXXX' },
  { icon: '💬', label: 'LINE Official', value: '@kaona-agri',    href: 'https://line.me/ti/p/@kaona-agri' },
  { icon: '📧', label: 'อีเมล',        value: 'support@kaona.app', href: 'mailto:support@kaona.app' },
];

const HOURS = [
  ['จันทร์–ศุกร์', '08:00–17:00'],
  ['เสาร์',        '08:00–12:00'],
  ['อาทิตย์/หยุดนักขัตฤกษ์', 'ปิด'],
];

const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, padding: '14px 16px', border: '0.5px solid var(--color-border-tertiary,#e4ede4)' },
  label: { margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500, letterSpacing: '.04em' },
  divider: { height: '0.5px', background: 'var(--color-border-tertiary,#e4ede4)', margin: '4px 0' },
} as const;

export default function ContactPage() {
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Hero */}
        <div style={{ ...S.card, textAlign: 'center', padding: '28px 20px', background: 'var(--color-background-secondary,#f9fafb)' }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🌽</div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>KaonA Agri</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary,#666)' }}>ระบบจัดการเกษตรกรรมครบวงจร</p>
        </div>

        {/* Features */}
        <div>
          <p style={S.label}>เกี่ยวกับเรา</p>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FEATURES.map((item) => (
              <div key={item.title} style={{ ...S.card, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{item.title}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary,#666)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <p style={S.label}>ติดต่อบริษัท</p>
          <div style={{ marginTop: 8, ...S.card, padding: 0, overflow: 'hidden' }}>
            {CONTACTS.map((item, i) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textDecoration: 'none', color: 'inherit', borderBottom: i < CONTACTS.length - 1 ? '0.5px solid var(--color-border-tertiary,#e4ede4)' : 'none' }}>
                <span style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{item.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary,#666)' }}>{item.value}</p>
                </div>
                <span style={{ color: 'var(--color-text-secondary,#888)', fontSize: 18 }}>›</span>
              </a>
            ))}
          </div>
        </div>

        {/* Hours */}
        <div>
          <p style={S.label}>เวลาทำการ</p>
          <div style={{ marginTop: 8, ...S.card }}>
            {HOURS.map(([day, time], i) => (
              <div key={day}>
                {i > 0 && <div style={S.divider} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#666)' }}>{day}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: time === 'ปิด' ? '#c62828' : 'var(--color-text-primary,#111)' }}>{time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Version */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-secondary,#888)', margin: 0 }}>
          KaonA Agri · v2.0 · 2025
        </p>

      </div>
    </MobileAppShell>
  );
}
