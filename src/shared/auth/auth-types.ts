export type AppRole = 'admin' | 'staff' | 'inspector' | 'leader' | 'truck_owner' | 'farmer';

export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'no_member'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'access_denied'
  | 'error';

export type AuthBootstrapResult = {
  member_id: string;
  auth_user_id: string | null;
  line_user_id: string;
  status: MemberStatus;
  is_approved: boolean;
  effective_role: AppRole | null;
  roles: AppRole[];
};

export type LiffRuntimeMode = 'production' | 'preview' | 'direct';

export type LiffBridgeDiagnostics = {
  supabaseUrlPresent: boolean;
  supabaseAnonKeyPresent: boolean;
  supabaseClientCreated: boolean;
  liffConfigPresent: boolean;
  liffSdkLoad: 'success' | 'failed' | 'not_attempted';
  liffInitAttempted: boolean;
  liffInitSuccess: boolean;
  liffInitError: string | null;
  liffWindowPresent: boolean;
  runtimeMode: LiffRuntimeMode;
  liffInitialized: boolean;
  liffLoggedIn: boolean;
  idTokenPresent: boolean;
  bridgeAttempted: boolean;
  bridgeSuccess: boolean;
  bridgeErrorMessage: string | null;
};
