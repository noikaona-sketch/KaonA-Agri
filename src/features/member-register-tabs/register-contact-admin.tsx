'use client';

export function RegisterContactAdmin() {
  return (
    <div className="mobile-stack">
      <div className="kaona-card" style={{ background: '#e8f5e9', borderColor: '#a5d6a7', textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>👨‍💼</div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: '#1b5e20' }}>ติดต่อทีม KaonA</p>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#4a6741' }}>พร้อมให้ความช่วยเหลือทุกวัน 08:00–17:00</p>
      </div>

      {[
        { icon: '📞', label: 'โทรศัพท์', value: '089-XXX-XXXX', href: 'tel:089XXXXXXX', color: '#e3f2fd', border: '#90caf9' },
        { icon: '💬', label: 'LINE Official', value: '@kaona-agri', href: 'https://line.me/ti/p/@kaona-agri', color: '#e8f5e9', border: '#a5d6a7' },
        { icon: '📧', label: 'อีเมล', value: 'support@kaona.app', href: 'mailto:support@kaona.app', color: '#fff8e1', border: '#ffe082' },
      ].map((item) => (
        <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 14, background: item.color, border: `1.5px solid ${item.border}`, borderRadius: 16, padding: '16px 18px', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 32, flexShrink: 0 }}>{item.icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{item.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 14, color: '#6b7280' }}>{item.value}</p>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 20, color: '#9ca3af' }}>›</span>
        </a>
      ))}

      <div className="kaona-card" style={{ background: '#f7faf7' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>🕐 เวลาทำการ</p>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
          จันทร์–ศุกร์: 08:00–17:00<br />
          เสาร์: 08:00–12:00<br />
          อาทิตย์และวันหยุดนักขัตฤกษ์: ปิด
        </p>
      </div>
    </div>
  );
}
