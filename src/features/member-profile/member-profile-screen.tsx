'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MemberIdentityCard } from '@/features/member-profile/member-identity-card';
import { MemberParticipationSummary } from '@/features/member-profile/member-participation-summary';
import { MemberStatusCard } from '@/features/member-profile/member-status-card';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';



type MemberProfileData = {
  full_name: string | null;
  identity_verification_status: string | null;
  line_display_name: string | null;
  line_avatar_url: string | null;
};

export function MemberProfileScreen() {
  const member = useCurrentMember();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [plotCount, setPlotCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [noBurnCount, setNoBurnCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      if (!member) return;

      setLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();

      const plotParams = new URLSearchParams({ line_user_id: member.line_user_id });
      const [memberResult, plotResult, cycleResult, noBurnResult] = await Promise.all([
        supabase
          .from('members')
          .select('full_name, identity_verification_status, line_display_name, line_avatar_url')
          .eq('id', member.member_id)
          .maybeSingle(),
        fetch(`/api/member/plots?${plotParams.toString()}`).then(async (r) => ({
          ok: r.ok,
          payload: (await r.json()) as { plots?: unknown[]; error?: string },
        })),
        supabase.from('planting_cycles').select('*', { count: 'exact', head: true }).eq('member_id', member.member_id),
        supabase.from('no_burn_requests').select('*', { count: 'exact', head: true }).eq('member_id', member.member_id),
      ]);

      if (memberResult.error || !plotResult.ok || cycleResult.error || noBurnResult.error) {
        setError(memberResult.error?.message ?? plotResult.payload.error ?? cycleResult.error?.message ?? noBurnResult.error?.message ?? 'ไม่สามารถโหลดข้อมูลได้');
        setLoading(false);
        return;
      }

      setProfile(memberResult.data);
      setPlotCount(plotResult.payload.plots?.length ?? 0);
      setCycleCount(cycleResult.count ?? 0);
      setNoBurnCount(noBurnResult.count ?? 0);
      setLoading(false);
    }

    void loadProfile();
  }, [member]);

  return (
    <MobileAppShell title="ศูนย์ข้อมูลสมาชิก" subtitle="ข้อมูลสมาชิกและสรุปการมีส่วนร่วม" roleBadge="โปรไฟล์" >
      {loading ? <LoadingState label="กำลังโหลดข้อมูลสมาชิก" /> : null}
      {error ? <ErrorState title="ไม่สามารถเข้าถึงโปรไฟล์" detail={error} /> : null}
      {!loading && !error && !profile ? <EmptyState title="ยังไม่พบข้อมูลสมาชิก" detail="กรุณาตรวจสอบสิทธิ์การเข้าถึง แล้วลองอีกครั้ง" /> : null}
      {!loading && !error && profile && member ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <MemberStatusCard status={member.status} effectiveRole={member.effective_role} roles={member.roles} />
          <MemberIdentityCard
            lineDisplayName={profile.line_display_name}
            lineAvatarUrl={profile.line_avatar_url}
            identityStatus={profile.identity_verification_status}
          />
          <MemberParticipationSummary plotCount={plotCount} cycleCount={cycleCount} noBurnCount={noBurnCount} />
        </div>
      ) : null}
    </MobileAppShell>
  );
}
