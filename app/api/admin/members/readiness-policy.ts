export type MemberReadinessInput = {
  phone?: string | null;
  address?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  citizen_id_masked?: string | null;
  line_user_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_verified_status?: string | null;
  has_plots?: boolean;
  has_vehicles?: boolean;
  roles?: string[];
};

export type MemberReadinessResult = {
  readyToApprove: boolean;
  missingFields: string[];
  readinessReason: string[];
};

export function evaluateMemberReadiness(input: MemberReadinessInput): MemberReadinessResult {
  const missingFields: string[] = [];
  const readinessReason: string[] = [];

  if (!input.phone) missingFields.push('phone');
  if (!input.address) missingFields.push('address');
  if (!input.subdistrict) missingFields.push('subdistrict');
  if (!input.district) missingFields.push('district');
  if (!input.province) missingFields.push('province');
  if (!input.citizen_id_masked || input.citizen_id_masked === 'PENDING') missingFields.push('citizen_id_masked');
  if (!input.line_user_id) missingFields.push('line_user_id');

  const hasBank = Boolean(input.bank_name && input.bank_account_number);
  if (!hasBank) missingFields.push('bank_account');
  if (input.bank_verified_status !== 'verified') missingFields.push('bank_verified_status');

  const roleSet = new Set(input.roles ?? []);
  if ((roleSet.has('farmer') || roleSet.has('leader')) && !input.has_plots) missingFields.push('plots');
  if (roleSet.has('truck_owner') && !input.has_vehicles) missingFields.push('vehicles');

  if (missingFields.length === 0) {
    readinessReason.push('ready_for_approval');
  } else {
    readinessReason.push(...missingFields.map((f) => `missing_${f}`));
  }

  return {
    readyToApprove: missingFields.length === 0,
    missingFields,
    readinessReason,
  };
}
