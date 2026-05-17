'use client';

import type { ReactNode } from 'react';

import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import type { AppRole, LiffBridgeDiagnostics } from '@/shared/auth/auth-types';

type ProtectedRouteProps = {
  allowedRoles?: AppRole[];
  allowPending?: boolean;   // ถ้า true: pending user เข้าได้ แต่ rejected/suspended ยังโดน block
  children: ReactNode;
  fallbackLoading?: ReactNode;
  fallbackUnauthenticated?: ReactNode;
  fallbackNoMember?: ReactNode;
  fallbackPendingApproval?: ReactNode;
  fallbackRejected?: ReactNode;
  fallbackSuspended?: ReactNode;
  fallbackAccessDenied?: ReactNode;
  fallbackError?: ReactNode;
};

function StateView({ title, subtitle, kicker = 'สถานะการเข้าใช้งาน' }: { title: string; subtitle: string; kicker?: string }) {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">{kicker}</p>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>
      </section>
    </main>
  );
}

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

function formatLiffDiagnostics(diagnostics: LiffBridgeDiagnostics) {
  return [
    `LIFF config present: ${yesNo(diagnostics.liffConfigPresent)}`,
    `LIFF SDK load: ${diagnostics.liffSdkLoad}`,
    `LIFF window present: ${yesNo(diagnostics.liffWindowPresent)}`,
    `LIFF init attempted: ${yesNo(diagnostics.liffInitAttempted)}`,
    `LIFF init success: ${yesNo(diagnostics.liffInitSuccess)}`,
    `LIFF init error: ${diagnostics.liffInitError ?? 'none'}`,
    `Runtime mode: ${diagnostics.runtimeMode}`,
    `LIFF initialized: ${yesNo(diagnostics.liffInitialized)}`,
    `LIFF logged in: ${yesNo(diagnostics.liffLoggedIn)}`,
    `ID token present: ${yesNo(diagnostics.idTokenPresent)}`,
    `Message: ${diagnostics.bridgeErrorMessage ?? 'none'}`,
  ].join(' · ');
}

export function ProtectedRoute({ allowedRoles, allowPending = false, children, ...fallbacks }: ProtectedRouteProps) {
  const { status, errorMessage, bridgeDiagnostics } = useAuth();
  const member = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  if (status === 'loading') return fallbacks.fallbackLoading ?? <StateView title="กำลังตรวจสอบบัญชี LINE" subtitle="กำลังยืนยันการเข้าสู่ระบบและข้อมูลสมาชิก" />;

  if (status === 'unauthenticated') {
    return (
      fallbacks.fallbackUnauthenticated ?? (
        <StateView title="กรุณาเข้าสู่ระบบผ่าน LINE" subtitle={formatLiffDiagnostics(bridgeDiagnostics)} />
      )
    );
  }

  if (status === 'error') return fallbacks.fallbackError ?? <StateView title="เกิดข้อผิดพลาดการยืนยันตัวตน" subtitle={errorMessage ?? 'กรุณาลองใหม่อีกครั้งในภายหลัง'} />;
  if (!member || status === 'no_member') return fallbacks.fallbackNoMember ?? <StateView title="ไม่พบโปรไฟล์สมาชิก" subtitle="บัญชี LINE นี้ยังไม่เชื่อมกับข้อมูลสมาชิก" />;

  // pending: ถ้า allowPending=true ให้ผ่านได้ (profile/status/edit)
  // ถ้า allowPending=false (default) → block พร้อม Thai message
  if (status === 'pending_approval' && !allowPending) {
    return fallbacks.fallbackPendingApproval ?? <StateView title="สถานะ: รออนุมัติ" subtitle="คำขอสมัครสมาชิกของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากเจ้าหน้าที่" kicker="รออนุมัติ" />;
  }

  if (status === 'rejected') return fallbacks.fallbackRejected ?? <StateView title="สถานะ: ไม่อนุมัติ" subtitle="คำขอสมัครสมาชิกของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อเจ้าหน้าที่เพื่อขอคำแนะนำ" kicker="ไม่สามารถเข้าใช้งานได้" />;
  if (status === 'suspended') return fallbacks.fallbackSuspended ?? <StateView title="บัญชีถูกระงับ" subtitle="บัญชีสมาชิกของคุณถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่" />;

  // approved check — ข้าม ถ้า allowPending และยังรออนุมัติอยู่
  if (member.is_approved !== true && !allowPending) {
    return fallbacks.fallbackAccessDenied ?? <StateView title="ยังไม่สามารถเข้าใช้งานได้" subtitle="เฉพาะสมาชิกสถานะ อนุมัติแล้ว เท่านั้นที่เข้าใช้งานส่วนนี้ได้" />;
  }

  // role check — ใช้กับ approved user เท่านั้น
  if (allowedRoles && allowedRoles.length > 0 && member.is_approved === true) {
    const memberRoles = member.roles ?? [];
    const hasRole = memberRoles.some((r) => allowedRoles.includes(r as AppRole));
    if (!hasRole) {
      return fallbacks.fallbackAccessDenied ?? <StateView title="ไม่มีสิทธิ์เข้าใช้งานส่วนนี้" subtitle="บทบาทของคุณไม่ได้รับอนุญาตให้เข้าใช้งานส่วนนี้ กรุณาติดต่อเจ้าหน้าที่" kicker="ไม่มีสิทธิ์เข้าถึง" />;
    }
  }

  return <>{children}</>;
}
