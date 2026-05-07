'use client';

import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

type MemberRegistrationMVPProps = {
  lineUserId: string;
  onSubmitted: () => Promise<void>;
};

export function MemberRegistrationMVP({ lineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  return (
    <FormSheet title="Member onboarding (MVP)">
      <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
        LINE user detected: <strong>{lineUserId}</strong>
      </p>
      <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
        This is a UI placeholder for member registration submission flow.
      </p>
      <UIButton fullWidth onClick={() => void onSubmitted()}>
        Submit registration (Mock)
      </UIButton>
    </FormSheet>
  );
}
