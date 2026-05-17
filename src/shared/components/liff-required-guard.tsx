'use client';

// LiffRequiredGuard — แสดงข้อความภาษาไทยเมื่อเปิดนอก LINE LIFF context
// ใช้ wrap หน้าที่ต้องการ LINE identity เช่น register, field staff, service
// ไม่แตะ auth flow — แค่ตรวจ status จาก useAuth()

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';

type Props = { children: React.ReactNode };

export function LiffRequiredGuard({ children }: Props) {
  const { status, bridgeDiagnostics } = useAuth();
  const [ready, setReady] = useState(false);

  // รอ auth provider load ก่อนตัดสิน
  useEffect(() => {
    if (status !== 'loading') setReady(true);
  }, [status]);

  if (!ready || status === 'loading') {
    return <LoadingState label="กำลังตรวจสอบ LINE…" />;
  }

  // ถ้า liff token ไม่มี หรือ auth ล้มเหลวเพราะไม่ใช่ LIFF context
  const isLiffMissing =
    status === 'unauthenticated' ||
    status === 'error' ||
    (bridgeDiagnostics as Record<string, unknown>)?.liff_not_ready === true ||
    (bridgeDiagnostics as Record<string, unknown>)?.token_available === false;

  if (isLiffMissing) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', background: 'var(--color-background-primary,#fff)',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 64 }}>💬</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>
          กรุณาเปิดผ่าน LINE
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-secondary,#666)', lineHeight: 1.7, maxWidth: 300 }}>
          กรุณาเปิดเมนูนี้ผ่าน LINE เพื่อยืนยันตัวตน
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary,#888)', lineHeight: 1.6, maxWidth: 300 }}>
          หน้านี้ต้องการการยืนยันตัวตนจาก LINE Mini App
          กรุณากลับไปที่ LINE แล้วกดเมนูอีกครั้ง
        </p>
        <div style={{
          marginTop: 8, background: 'var(--color-background-secondary,#f9fafb)',
          borderRadius: 14, padding: '14px 20px',
          border: '0.5px solid var(--color-border-tertiary,#e4ede4)',
          fontSize: 13, color: 'var(--color-text-secondary,#666)',
        }}>
          ติดต่อสอบถาม LINE OA: <strong>@kaona-agri</strong>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
