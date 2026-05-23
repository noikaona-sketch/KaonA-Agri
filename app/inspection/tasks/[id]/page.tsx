'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton }                from '@/shared/components/ui-button';
import { NoBurnObservationForm }   from '@/features/no-burn-community/no-burn-observation-form';
import { InspectorResultForm }     from '@/features/inspection-tasks/inspector-result-form';

type Task = {
  id: string; result_status: string; result_note: string | null;
  assigned_at: string; visited_at: string | null;
  plots: { id: string; name: string; province: string | null; area_rai: number | null; lat: number | null; lng: number | null }[] | null;
  members: { full_name: string; phone: string | null }[] | null;
  no_burn_requests: { id: string; status: string }[] | null;
};

type Props = { params: { id: string } };

export default function InspectionTaskDetailPage({ params }: Props) {
  const member  = useCurrentMember();
  const router  = useRouter();
  const [task, setTask]       = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [notice, setNotice]   = useState<string | null>(null);
  // result maps to inspections.result_status constraint values
  const [result, setResult]   = useState<'passed' | 'failed' | 'needs_update'>('passed');
  const [note, setNote]       = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: e } = await s.from('inspections')
        .select('id,result_status,result_note,assigned_at,visited_at,plots(id,name,province,area_rai,lat,lng),members(full_name,phone),no_burn_requests(id,status)')
        .eq('id', params.id).maybeSingle();
      if (e) { setError(e.message); }
      else { setTask(data as Task); if (data?.result_note) setNote((data as Task).result_note ?? ''); }
      setLoading(false);
    })();
  }, [params.id]);

  async function saveResult() {
    if (!task || !member?.member_id) return;
    setSaving(true);
    const s = createSupabaseBrowserClient();

    // Update inspections row first
    const { error: inspErr } = await s.from('inspections').update({
      result_status: result,
      result_note:   note || null,
      visited_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }).eq('id', task.id);

    if (inspErr) {
      setSaving(false);
      setError(inspErr.message);
      return;
    }

    // Map inspection result → no_burn_requests status transition
    // passed           → approved
    // failed           → rejected
    // needs_update     → inspection_required (send back for more evidence)
    const noBurnStatusMap: Record<string, string> = {
      passed:       'approved',
      failed:       'rejected',
      needs_update: 'inspection_required',
    };
    const noBurnStatus = noBurnStatusMap[result];
    const noBurnId = task.no_burn_requests?.[0]?.id;

    if (noBurnId && noBurnStatus) {
      const { error: nbrErr } = await s.from('no_burn_requests').update({
        status:      noBurnStatus,
        review_note: note || null,
      }).eq('id', noBurnId);
      if (nbrErr) {
        console.warn('[INSPECTION] no_burn_requests update failed:', nbrErr.message);
        // Non-fatal — inspection result saved, status sync failed
      }
    }

    setSaving(false);
    const resultLabel: Record<string, string> = {
      passed:       'ผ่านการตรวจ ✅',
      failed:       'ไม่ผ่าน ⛔',
      needs_update: 'ต้องแก้ไขเพิ่มเติม 📋',
    };
    setNotice(`✅ บันทึกผลตรวจแล้ว — ${resultLabel[result] ?? result}`);
    setShowForm(false);
    setTask((p) => p ? { ...p, result_status: result, result_note: note || null } : p);
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !task) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const isDone = ['passed', 'failed', 'needs_update', 'completed'].includes(task.result_status);

  return (
    <MobileAppShell title="บันทึกผลตรวจ" subtitle="ตรวจสอบและบันทึกผลการตรวจแปลง">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        <Link href="/inspection/tasks" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← กลับรายการ
        </Link>

        {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

        {/* Task info */}
        <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{task.plots?.[0]?.name ?? '—'}</p>
          {task.plots?.[0]?.province && <p style={{ margin: '2px 0 0', fontSize: 14, opacity: 0.85 }}>{task.plots[0].province}</p>}
          <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.85 }}>
            👤 {task.members?.[0]?.full_name ?? '—'} {task.members?.[0]?.phone ? `· ${task.members[0].phone}` : ''}
          </p>
          {task.plots?.[0]?.area_rai && <p style={{ margin: '2px 0 0', fontSize: 14, opacity: 0.85 }}>พื้นที่ {task.plots[0].area_rai} ไร่</p>}
        </div>

        {/* GPS */}
        {task.plots?.[0]?.lat && task.plots?.[0]?.lng && (
          <a href={`https://maps.google.com/?q=${task.plots[0].lat},${task.plots[0].lng}`} target="_blank" rel="noopener noreferrer"
            className="kaona-card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text-primary)' }}>
            <span style={{ fontSize: 24 }}>📍</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>เปิดใน Google Maps</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{task.plots[0].lat!.toFixed(5)}, {task.plots[0].lng!.toFixed(5)}</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text-secondary)' }}>›</span>
          </a>
        )}

        {/* สถานะปัจจุบัน */}
        {isDone && (
          <div className="kaona-card" style={{ background: task.result_status === 'passed' ? '#e8f5e9' : task.result_status === 'needs_update' ? '#fff8e1' : '#ffebee', borderColor: task.result_status === 'passed' ? '#a5d6a7' : '#ef9a9a' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: task.result_status === 'passed' ? '#1b5e20' : task.result_status === 'needs_update' ? '#e65100' : '#c62828' }}>
              {task.result_status === 'passed' ? '✅ ผ่านการตรวจ' : task.result_status === 'needs_update' ? '📋 ต้องแก้ไขเพิ่มเติม' : '❌ ไม่ผ่านการตรวจ'}
            </p>
            {task.result_note && <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{task.result_note}</p>}
            {task.visited_at && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>ตรวจเมื่อ {new Date(task.visited_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
          </div>
        )}

        {/* form บันทึก */}
        {!isDone && (
          <>
            {!showForm ? (
              <UIButton fullWidth onClick={() => setShowForm(true)}>📝 บันทึกผลการตรวจ</UIButton>
            ) : (
              <div className="kaona-card">
                <InspectorResultForm
                  inspectionId={task.id}
                  plotName={(task.plots as { name: string }[] | null)?.[0]?.name}
                  farmerName={(task.members as { full_name: string }[] | null)?.[0]?.full_name}
                  onSuccess={() => { setShowForm(false); router.refresh(); }}
                />
                <button className="admin-btn admin-btn--ghost" onClick={() => setShowForm(false)}
                  style={{ width:'100%', marginTop:8, fontSize:13 }}>ยกเลิก</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Service team field observation — shown when task links to a no-burn request */}
      {task.no_burn_requests?.[0]?.id && (
        <NoBurnObservationForm
          noBurnRequestId={task.no_burn_requests[0].id}
        />
      )}
    </MobileAppShell>
  );
}
