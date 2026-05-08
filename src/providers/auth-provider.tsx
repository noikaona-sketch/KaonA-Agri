'use client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { ensureLiffIdToken, getLiffBridgeDiagnostics, getLiffBridgeSnapshot } from '@/lib/liff/init-liff';
import { getSupabaseClientDiagnostics, tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AppRole,
  AuthBootstrapResult,
  AuthStatus,
  LiffBridgeDiagnostics,
  MemberStatus,
} from '@/shared/auth/auth-types';

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

type BootstrapRpcRow = {
  member_id: string;
  auth_user_id: string;
  line_user_id: string;
  status: string;
  is_approved: boolean;
  effective_role: string | null;
  roles: string[];
};

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
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

function normalizeBootstrap(row: BootstrapRpcRow): AuthBootstrapResult {
  return {
    member_id: row.member_id,
    auth_user_id: row.auth_user_id,
    line_user_id: row.line_user_id,
    status: isMemberStatus(row.status) ? row.status : 'pending',
    is_approved: row.is_approved,
    effective_role: row.effective_role && isAppRole(row.effective_role) ? row.effective_role : null,
    roles: row.roles.filter(isAppRole),
  };
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
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<AuthBootstrapResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState<LiffBridgeDiagnostics>(INITIAL_BRIDGE_DIAGNOSTICS);

  useEffect(() => {
    let isCancelled = false;

    setBridgeDiagnostics(getCombinedDiagnostics());

    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      void getLiffBridgeSnapshot()
        .then((snapshot) => {
          if (isCancelled) return;

          setMember(null);
          setSession(null);
          setStatus('error');
          setErrorMessage('Supabase session not available');
          setBridgeDiagnostics({
            ...snapshot,
            ...getSupabaseClientDiagnostics(),
            bridgeErrorMessage: 'Supabase session not available',
          });
        })
        .catch(() => {
          if (isCancelled) return;

          setMember(null);
          setStatus('error');
          setSession(null);
          setErrorMessage('Supabase session not available');
          setBridgeDiagnostics(withBridgeMessage('Supabase session not available'));
        });

      return () => {
        isCancelled = true;
      };
    }

    const supabaseClient = supabase;

    async function bridgeLiffToSupabaseSession() {
      const snapshot = await getLiffBridgeSnapshot();
      setBridgeDiagnostics({
        ...snapshot,
        ...getSupabaseClientDiagnostics(),
        bridgeAttempted: true,
        bridgeSuccess: false,
        bridgeErrorMessage: null,
      });

      const idToken = await ensureLiffIdToken();

      if (!idToken) {
        setBridgeDiagnostics((previous) => ({
          ...previous,
          ...getCombinedDiagnostics(),
          bridgeAttempted: true,
          bridgeSuccess: false,
          bridgeErrorMessage: 'LIFF login is required',
        }));
        return null;
      }

      type SignInWithIdTokenParams = Parameters<typeof supabaseClient.auth.signInWithIdToken>[0];
      const params = { provider: 'custom:line', token: idToken } as SignInWithIdTokenParams;
      const { data, error } = await supabaseClient.auth.signInWithIdToken(params);

      if (error) {
        setBridgeDiagnostics((previous) => ({
          ...previous,
          ...getCombinedDiagnostics(),
          bridgeAttempted: true,
          bridgeSuccess: false,
          bridgeErrorMessage: 'Supabase LINE session exchange failed',
        }));
        throw new Error('Supabase LINE session exchange failed');
      }

      setBridgeDiagnostics((previous) => ({
        ...previous,
        ...getCombinedDiagnostics(),
        bridgeAttempted: true,
        bridgeSuccess: true,
        bridgeErrorMessage: null,
      }));

      return data.session;
    }

    async function bootstrapWithSession(currentSession: Session | null) {
      try {
        setSession(currentSession);
        setErrorMessage(null);

        if (!currentSession) {
          setMember(null);
          setStatus('unauthenticated');
          return;
        }

        const { data, error } = await supabaseClient.rpc('bootstrap_auth_session');

        if (error) {
          setMember(null);
          setStatus('error');
          setErrorMessage('Authentication bootstrap failed');
          setBridgeDiagnostics(withBridgeMessage('Authentication bootstrap failed'));
          return;
        }

        const bootstrapRow = Array.isArray(data) ? (data[0] as BootstrapRpcRow | undefined) : undefined;

        if (!bootstrapRow) {
          setMember(null);
          setStatus('no_member');
          return;
        }

        const bootstrapResult = normalizeBootstrap(bootstrapRow);
        setMember(bootstrapResult);

        if (bootstrapResult.status === 'pending') return setStatus('pending_approval');
        if (bootstrapResult.status === 'rejected') return setStatus('rejected');
        if (bootstrapResult.status === 'suspended') return setStatus('suspended');
        if (!bootstrapResult.is_approved) return setStatus('access_denied');

        return setStatus('approved');
      } catch {
        setMember(null);
        setStatus('error');
        setErrorMessage('Authentication bootstrap failed');
        setBridgeDiagnostics(withBridgeMessage('Authentication bootstrap failed'));
      }
    }

    async function resolveInitialSession() {
      try {
        const { data } = await supabaseClient.auth.getSession();

        if (data.session) {
          await bootstrapWithSession(data.session);
          return;
        }

        const bridgedSession = await bridgeLiffToSupabaseSession();
        await bootstrapWithSession(bridgedSession);
      } catch {
        try {
          const bridgedSession = await bridgeLiffToSupabaseSession();
          await bootstrapWithSession(bridgedSession);
        } catch {
          setStatus('error');
          setErrorMessage('Supabase LINE session exchange failed');
          setBridgeDiagnostics((previous) => ({
            ...previous,
            ...getCombinedDiagnostics(),
            bridgeAttempted: true,
            bridgeSuccess: false,
            bridgeErrorMessage: 'Supabase LINE session exchange failed',
          }));
        }
      }
    }

    void resolveInitialSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, updatedSession) => {
      void bootstrapWithSession(updatedSession).catch(() => {
        setMember(null);
        setStatus('error');
        setErrorMessage('Authentication bootstrap failed');
        setBridgeDiagnostics(withBridgeMessage('Authentication bootstrap failed'));
      });
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ status, session, member, errorMessage, bridgeDiagnostics }),
    [status, session, member, errorMessage, bridgeDiagnostics]
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
