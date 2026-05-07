'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type DashboardMetrics = {
  pendingMemberApprovals: number;
  pendingNoBurnRequests: number;
  assignedInspections: number;
  failedInspections: number;
  activePlantingCycles: number;
};

type RecentActivity = {
  id: string;
  resource_type: string;
  status: string;
  created_at: string;
  note: string | null;
};

const INITIAL_METRICS: DashboardMetrics = {
  pendingMemberApprovals: 0,
  pendingNoBurnRequests: 0,
  assignedInspections: 0,
  failedInspections: 0,
  activePlantingCycles: 0,
};

export function AdminOperationalDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const [memberApprovalsResult, noBurnRequestsResult, assignedInspectionsResult, failedInspectionsResult, activePlantingCyclesResult, recentActivityResult] =
      await Promise.all([
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('resource_type', 'member').eq('status', 'pending'),
        supabase
          .from('no_burn_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'under_review', 'inspection_required'])
          .is('deleted_at', null),
        supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('result_status', 'assigned'),
        supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('result_status', 'failed'),
        supabase.from('planting_cycles').select('id', { count: 'exact', head: true }).in('status', ['planned', 'growing']),
        supabase
          .from('approvals')
          .select('id, resource_type, status, created_at, note')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

    const firstError =
      memberApprovalsResult.error ??
      noBurnRequestsResult.error ??
      assignedInspectionsResult.error ??
      failedInspectionsResult.error ??
      activePlantingCyclesResult.error ??
      recentActivityResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setMetrics({
      pendingMemberApprovals: memberApprovalsResult.count ?? 0,
      pendingNoBurnRequests: noBurnRequestsResult.count ?? 0,
      assignedInspections: assignedInspectionsResult.count ?? 0,
      failedInspections: failedInspectionsResult.count ?? 0,
      activePlantingCycles: activePlantingCyclesResult.count ?? 0,
    });
    setActivities(Array.isArray(recentActivityResult.data) ? (recentActivityResult.data as RecentActivity[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  return (
    <>
      <FormSheet
        title="แดชบอร์ดงานปฏิบัติการ"
        footer={
          <UIButton variant="secondary" onClick={() => void loadMetrics()} loading={loading}>
            รีเฟรชข้อมูล
          </UIButton>
        }
      >
        {error ? <ErrorState title="โหลดข้อมูลแดชบอร์ดไม่สำเร็จ" detail={error} /> : null}

        <InfoCard
          title="คิวอนุมัติสมาชิก"
          subtitle={loading ? 'กำลังโหลดคิวอนุมัติ…' : `${metrics.pendingMemberApprovals} รายการรออนุมัติ`}
          meta={<StatusChip status={metrics.pendingMemberApprovals > 0 ? 'under_review' : 'approved'} />}
          action={<Link href="/admin/members">เปิดหน้าตรวจอนุมัติสมาชิก</Link>}
        />

        <InfoCard
          title="คิวตรวจคำขอไม่เผา"
          subtitle={loading ? 'กำลังโหลดคำขอไม่เผา…' : `${metrics.pendingNoBurnRequests} รายการรอตรวจ`}
          meta={<StatusChip status={metrics.pendingNoBurnRequests > 0 ? 'under_review' : 'approved'} />}
        />

        <InfoCard
          title="งานตรวจที่มอบหมาย"
          subtitle={loading ? 'กำลังโหลดงานตรวจ…' : `${metrics.assignedInspections} งานที่อยู่ระหว่างตรวจ`}
          meta={<StatusChip status={metrics.assignedInspections > 0 ? 'under_review' : 'approved'} />}
        />

        <InfoCard
          title="ผลตรวจไม่ผ่าน"
          subtitle={loading ? 'กำลังโหลดผลตรวจ…' : `${metrics.failedInspections} รายการไม่ผ่าน`}
          meta={<StatusChip status={metrics.failedInspections > 0 ? 'rejected' : 'approved'} />}
        />

        <InfoCard
          title="รอบปลูกที่กำลังดำเนินการ"
          subtitle={loading ? 'กำลังโหลดรอบปลูก…' : `${metrics.activePlantingCycles} รอบปลูกที่ใช้งานอยู่`}
          meta={<StatusChip status={metrics.activePlantingCycles > 0 ? 'scheduled' : 'completed'} />}
        />
      </FormSheet>

      <FormSheet title="สถานะล่าสุด">
        {loading ? <p>กำลังโหลดกิจกรรมล่าสุด…</p> : null}
        {!loading && activities.length === 0 ? <p>ยังไม่มีกิจกรรมล่าสุด</p> : null}
        {!loading
          ? activities.map((activity) => (
              <article key={activity.id}>
                <p>
                  {activity.resource_type} · {activity.status}
                </p>
                <p>{new Date(activity.created_at).toLocaleString('th-TH')}</p>
                {activity.note ? <p>หมายเหตุ: {activity.note}</p> : null}
                <hr style={{ margin: '10px 0' }} />
              </article>
            ))
          : null}
      </FormSheet>
    </>
  );
}
