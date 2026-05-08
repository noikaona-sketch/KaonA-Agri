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
  auth_user_id: string;
  line_user_id: string;
  status: MemberStatus;
  is_approved: boolean;
  effective_role: AppRole | null;
  roles: AppRole[];
};

export type LiffBridgeDiagnostics = {
  liffInitialized: boolean;
  liffLoggedIn: boolean;
  idTokenPresent: boolean;
  bridgeAttempted: boolean;
  bridgeSuccess: boolean;
  bridgeErrorMessage: string | null;
};
