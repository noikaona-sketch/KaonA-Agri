'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { ensureLiffIdToken, getLiffBridgeDiagnostics, getLiffBridgeSnapshot } from '@/lib/liff/init-liff';
import { getSupabaseClientDiagnostics, tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AppRole,
  AuthBootstrapResult,
  AuthStatus,
  LiffBridgeDiagnostics,
  MemberStatus,
} from '@/shared/auth/auth-types';
import { isAdminWebPath } from '@/shared/auth/admin-web-path';

const APP_ROLES: AppRole[] = ['admin', 'staff', 'inspector', 'leader', 'truck_owner', 'farmer'];
const MEMBER_STATUSES: MemberStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

const INITIAL_BRIDGE_DIAGNOSTICS: LiffBridgeDiagnostics = {
  supabaseUrlPresent: false,
  supabaseAnonKeyPresent: false,
  supabaseClientCreated: false,
  liffConfigPresent: false,
  liffSdkLoad: 'not_attempted',
  liffInitAttempted: false,
  liffInitSuccess: false,
  liffInitError: null,
  liffWindowPresent: false,
  runtimeMode: 'direct',
  liffInitialized: false,
  liffLoggedIn: false,
  idTokenPresent: false,
  bridgeAttempted: false,
  bridgeSuccess: false,
  bridgeErrorMessage: null,
};

type AuthContextValue = {
  status: AuthStatus;
  session: null;
  member: AuthBootstrapResult | null;
  errorMessage: string | null;
  bridgeDiagnostics: LiffBridgeDiagnostics;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function isAppRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

function isMemberStatus(status: string): status is MemberStatus {
  return MEMBER_STATUSES.includes(status as MemberStatus);
}

function getCombinedDiagnostics(): LiffBridgeDiagnostics {
  return {
    ...getLiffBridgeDiagnostics(),
    ...getSupabaseClientDiagnostics(),
  };
}

function withBridgeMessage(message: string): LiffBridgeDiagnostics {
  return {
    ...getCombinedDiagnostics(),
    bridgeErrorMessage: message,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [member, setMember] = useState<AuthBootstrapResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState<LiffBridgeDiagnostics>(INITIAL_BRIDGE_DIAGNOSTICS);

  useEffect(() => {
    if (isAdminWebPath(pathname)) {
      setStatus('unauthenticated');
      setMember(null);
      setErrorMessage(null);
      setBridgeDiagnostics(getCombinedDiagnostics());
      return;
    }
  }, [pathname]);

  useEffect(() => {
    if (isAdminWebPath(pathname)) return; // handled above

    const isPublicRegistrationPath =
      pathname === '/service/register' || pathname === '/field/assist-registration' || pathname === '/field/register-role';

    let isCancelled = false;

    async function bootstrap() {
      try {
        setBridgeDiagnostics(getCombinedDiagnostics());

        // ── Session cache: โหลดข้อมูลเดิมก่อนเพื่อลด loading time ──
        const CACHE_KEY = 'kaona_auth_cache';
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { member, status: cachedStatus, ts } = JSON.parse(cached) as {
              member: AuthBootstrapResult; status: string; ts: number;
            };
            // cache อายุ 10 นาที
            if (Date.now() - ts < 10 * 60 * 1000 && member && cachedStatus === 'approved') {
              setMember(member);
              setStatus('approved');
              // bootstrap ต่อใน background เพื่ออัปเดต cache
            }
          } catch { sessionStorage.removeItem(CACHE_KEY); }
        }

        const snapshot = await getLiffBridgeSnapshot();

        if (isCancelled) {
          return;
        }

        setBridgeDiagnostics({
          ...snapshot,
          ...getSupabaseClientDiagnostics(),
        });

        const idToken = await ensureLiffIdToken();

        if (!idToken) {
          setStatus('unauthenticated');
          setMember(null);
          setErrorMessage('LINE login required');
          return;
        }

        const response = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            devRole: typeof window !== 'undefined'
              ? (new URLSearchParams(window.location.search).get('role') ?? 'farmer')
              : 'farmer',
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          member?: AuthBootstrapResult;
        };

        if (!response.ok || !payload.member) {
          if (isPublicRegistrationPath && payload.error === 'LINE token verification failed') {
            setMember(null);
            setStatus('unauthenticated');
            setErrorMessage(null);
            return;
          }

          setMember(null);
          setStatus('error');
          setErrorMessage(payload.error ?? 'Authentication bootstrap failed');
          setBridgeDiagnostics(withBridgeMessage(payload.error ?? 'Authentication bootstrap failed'));
          return;
        }

        // signInWithIdToken เพื่อสร้าง Supabase session บน browser client — จำเป็นสำหรับ RLS
        const supabase = tryCreateSupabaseBrowserClient();
        if (supabase && idToken) {
          await supabase.auth.signInWithIdToken({ provider: 'kakao', token: idToken });
        }

        const bootstrapResult: AuthBootstrapResult = {
          ...payload.member,
          roles: payload.member.roles.filter(isAppRole),
          effective_role:
            payload.member.effective_role && isAppRole(payload.member.effective_role)
              ? payload.member.effective_role
              : null,
          status: isMemberStatus(payload.member.status) ? payload.member.status : 'pending',
        };

        setMember(bootstrapResult);
        setErrorMessage(null);

        // บันทึก cache สำหรับ approved member
        if (bootstrapResult.is_approved) {
          try {
            sessionStorage.setItem('kaona_auth_cache', JSON.stringify({
              member: bootstrapResult, status: 'approved', ts: Date.now(),
            }));
          } catch { /* sessionStorage full */ }
        }

        if (bootstrapResult.status === 'pending') {
          setStatus('pending_approval');
          return;
        }

        if (bootstrapResult.status === 'rejected') {
          setStatus('rejected');
          return;
        }

        if (bootstrapResult.status === 'suspended') {
          setStatus('suspended');
          return;
        }

        if (!bootstrapResult.is_approved) {
          setStatus('access_denied');
          return;
        }

        setStatus('approved');
      } catch {
        if (isCancelled) {
          return;
        }

        setMember(null);
        setStatus('error');
        setErrorMessage('Authentication bootstrap failed');
        setBridgeDiagnostics(withBridgeMessage('Authentication bootstrap failed'));
      }
    }

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, []); // bootstrap ครั้งเดียวเมื่อ mount — ไม่ deps pathname เพื่อลด LIFF call

  const value = useMemo(
    () => ({ status, session: null, member, errorMessage, bridgeDiagnostics }),
    [status, member, errorMessage, bridgeDiagnostics]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}

export function useCurrentMember() {
  return useAuth().member;
}

export function useCurrentRoles() {
  return useAuth().member?.roles ?? [];
}

export function useEffectiveRole(): AppRole | null {
  return useAuth().member?.effective_role ?? null;
}
