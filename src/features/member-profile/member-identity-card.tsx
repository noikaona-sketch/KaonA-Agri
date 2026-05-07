import { InfoCard } from '@/shared/components/info-card';

const IDENTITY_STATUS_LABELS: Record<string, string> = {
  verified: 'ยืนยันตัวตนแล้ว',
  pending: 'กำลังตรวจสอบ',
  rejected: 'ยืนยันตัวตนไม่ผ่าน',
};

type MemberIdentityCardProps = {
  lineDisplayName: string | null;
  lineAvatarUrl: string | null;
  identityStatus: string | null;
};

export function MemberIdentityCard({ lineDisplayName, lineAvatarUrl, identityStatus }: MemberIdentityCardProps) {
  return (
    <InfoCard
      title="ข้อมูลตัวตน"
      subtitle={`สถานะยืนยันตัวตน: ${identityStatus ? (IDENTITY_STATUS_LABELS[identityStatus] ?? 'ไม่มีข้อมูล') : 'ไม่มีข้อมูล'}`}
      action={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {lineAvatarUrl ? <img src={lineAvatarUrl} alt="LINE avatar" width={44} height={44} style={{ borderRadius: 999 }} /> : null}
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>ชื่อแสดงผล LINE</p>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{lineDisplayName ?? 'ยังไม่มีข้อมูล'}</p>
          </div>
        </div>
      }
    />
  );
}
