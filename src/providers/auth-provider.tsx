'use client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { ensureLiffIdToken, getLiffBridgeSnapshot } from '@/lib/liff/init-liff';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AppRole,
  AuthBootstrapResult,
  AuthStatus,
  LiffBridgeDiagnostics,
  MemberStatus,
} from '@/shared/auth/auth-types';

const APP_ROLES: AppRole[] = ['admin', 'staff', 'inspector', 'leader', 'truck_owner', 'farmer'];
const MEMBER_STATUSES: MemberStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

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

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<AuthBootstrapResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState<LiffBridgeDiagnostics>({
    liffInitialized: false,
    liffLoggedIn: false,
    idTokenPresent: false,
    bridgeAttempted: false,
    bridgeSuccess: false,
    bridgeErrorMessage: null,
  });

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      setMember(null);
      setSession(null);
      setStatus('error');
      setErrorMessage('Configuration error: missing Supabase public environment variables.');
      return;
    }

    const supabaseClient = supabase;

    async function bridgeLiffToSupabaseSession() {
      const snapshot = await getLiffBridgeSnapshot();
      setBridgeDiagnostics((previous) => ({
        ...previous,
        ...snapshot,
      }));

      const idToken = await ensureLiffIdToken();

      if (!idToken) {
        setBridgeDiagnostics((previous) => ({
          ...previous,
          bridgeAttempted: true,
          bridgeSuccess: false,
          bridgeErrorMessage: 'LIFF login is required before creating a Supabase session.',
        }));
        return null;
      }

      type SignInWithIdTokenParams = Parameters<typeof supabaseClient.auth.signInWithIdToken>[0];

      // Supabase custom OIDC providers use the `custom:<provider-id>` identifier.
      // For LINE configured as custom provider id `line`, use `custom:line`.
      const params = { provider: 'custom:line', token: idToken } as SignInWithIdTokenParams;

      const { data, error } = await supabaseClient.auth.signInWithIdToken(params);

      if (error) {
        setBridgeDiagnostics((previous) => ({
          ...previous,
          bridgeAttempted: true,
          bridgeSuccess: false,
          bridgeErrorMessage: error.message,
        }));
        throw error;
      }

      setBridgeDiagnostics((previous) => ({
        ...previous,
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
          setErrorMessage(error.message);
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
      } catch (error: unknown) {
        setMember(null);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unexpected authentication error.');
      }
    }

    void supabaseClient.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          await bootstrapWithSession(data.session);
          return;
        }

        const bridgedSession = await bridgeLiffToSupabaseSession();
        await bootstrapWithSession(bridgedSession);
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unexpected authentication error.');
      });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, updatedSession) => {
      void bootstrapWithSession(updatedSession).catch((error: unknown) => {
        setMember(null);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unexpected authentication error.');
      });
    });

    return () => {
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
