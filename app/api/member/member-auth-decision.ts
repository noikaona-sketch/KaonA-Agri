export type MemberAuthResolution =
  | { kind: 'approved'; memberId: string }
  | { kind: 'invalid' }
  | { kind: 'unapproved' };

export type MemberAuthDecision =
  | { ok: true; memberId: string }
  | { ok: false; status: 401 | 403; error: string };

type DecideMemberAuthInput = {
  bearer?: MemberAuthResolution;
  lineIdToken?: MemberAuthResolution;
  explicit?: MemberAuthResolution;
  hasExplicitIdentity: boolean;
  allowExplicitIdentity?: boolean;
};

function decisionFromCredential(resolution: MemberAuthResolution): MemberAuthDecision {
  if (resolution.kind === 'approved') return { ok: true, memberId: resolution.memberId };
  if (resolution.kind === 'unapproved') {
    return { ok: false, status: 403, error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' };
  }

  return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบก่อน' };
}

export function decideApprovedMemberAuth({
  bearer,
  lineIdToken,
  explicit,
  hasExplicitIdentity,
  allowExplicitIdentity = true,
}: DecideMemberAuthInput): MemberAuthDecision {
  if (bearer) return decisionFromCredential(bearer);
  if (lineIdToken) return decisionFromCredential(lineIdToken);

  if (allowExplicitIdentity && explicit) return decisionFromCredential(explicit);

  if (allowExplicitIdentity && hasExplicitIdentity) {
    return { ok: false, status: 403, error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' };
  }

  return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบก่อน' };
}
