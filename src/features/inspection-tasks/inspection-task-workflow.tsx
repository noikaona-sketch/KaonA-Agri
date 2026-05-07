'use client';

import { useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useCurrentRoles, useEffectiveRole } from '@/providers/auth-provider';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';

import { ResultForm } from './result-form';
import { TaskCard } from './task-card';
import { TaskDetail } from './task-detail';
import type { InspectionTaskRow, NoBurnRequestOption, PlotOption } from './types';

export function InspectionTaskWorkflow() {
  const member = useCurrentMember();
  const roles = useCurrentRoles();
  const effectiveRole = useEffectiveRole();

  const isStaffOrAdmin = useMemo(() => roles.includes('staff') || roles.includes('admin'), [roles]);
  const isInspector = useMemo(() => roles.includes('inspector'), [roles]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [noBurnRequests, setNoBurnRequests] = useState<NoBurnRequestOption[]>([]);
  const [plots, setPlots] = useState<PlotOption[]>([]);
  const [tasks, setTasks] = useState<InspectionTaskRow[]>([]);

  const [selectedNoBurnRequestId, setSelectedNoBurnRequestId] = useState('');
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState('');

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);

  async function loadData() {
    if (!member) return;
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const inspectionQuery = supabase
      .from('inspections')
      .select('id,no_burn_request_id,plot_id,inspector_member_id,assigned_at,visited_at,result_status,result_note,created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    const scopedInspectionQuery = isInspector && !isStaffOrAdmin ? inspectionQuery.eq('inspector_member_id', member.member_id) : inspectionQuery;

    const [{ data: requestData, error: requestError }, { data: plotData, error: plotError }, { data: taskData, error: taskError }] = await Promise.all([
      supabase.from('no_burn_requests').select('id,status').order('created_at', { ascending: false }).limit(30),
      supabase.from('plots').select('id,plot_name,name').order('created_at', { ascending: false }).limit(100),
      scopedInspectionQuery,
    ]);

    setLoading(false);
    if (requestError || plotError || taskError) {
      setError(requestError?.message ?? plotError?.message ?? taskError?.message ?? 'ไม่สามารถโหลดข้อมูลงานตรวจได้');
      return;
    }

    setNoBurnRequests((requestData ?? []) as NoBurnRequestOption[]);
    setPlots((plotData ?? []) as PlotOption[]);
    setTasks((taskData ?? []) as InspectionTaskRow[]);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.member_id, isInspector, isStaffOrAdmin]);

  async function createTask() {
    if (!member) return;
    setError(null);
    setMessage(null);
    if (!isStaffOrAdmin) return setError('เฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้นที่สร้างงานตรวจได้');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('inspections').insert({
      no_burn_request_id: selectedNoBurnRequestId || null,
      plot_id: selectedPlotId || null,
      inspector_member_id: member.member_id,
      assigned_at: new Date().toISOString(),
      result_status: 'assigned',
      result_note: assignmentNote || null,
    });
    setSubmitting(false);

    if (insertError) return setError(insertError.message);
    setMessage('สร้างงานตรวจเรียบร้อยแล้ว');
    await loadData();
  }

  async function updateTaskStatus(taskId: string, status: InspectionTaskRow['result_status']) {
    setUpdatingId(taskId);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const payload = {
      result_status: status,
      result_note: selectedTaskId === taskId && resultNote ? resultNote : undefined,
      visited_at: status === 'passed' || status === 'failed' || status === 'completed' ? new Date().toISOString() : null,
    };
    const { error: updateError } = await supabase.from('inspections').update(payload).eq('id', taskId);
    setUpdatingId(null);
    if (updateError) return setError(updateError.message);
    setMessage('อัปเดตสถานะงานตรวจเรียบร้อยแล้ว');
    await loadData();
  }

  return (
    <MobileAppShell title="งานตรวจแปลง" subtitle="ติดตามคิว ตรวจผล และแนบหลักฐาน" roleBadge={effectiveRole ?? 'farmer'}>
      <SectionHeader title="รายการงานตรวจ" subtitle="ระบบจะแสดงตามสิทธิ์และ RLS" />
      {isStaffOrAdmin ? (
        <ResultForm
          loading={loading}
          submitting={submitting}
          noBurnRequests={noBurnRequests}
          plots={plots}
          selectedNoBurnRequestId={selectedNoBurnRequestId}
          selectedPlotId={selectedPlotId}
          note={assignmentNote}
          onNoBurnChange={setSelectedNoBurnRequestId}
          onPlotChange={setSelectedPlotId}
          onNoteChange={setAssignmentNote}
          onSubmit={createTask}
        />
      ) : null}

      {loading ? <LoadingState label="กำลังโหลดงานตรวจ" /> : null}
      {!loading && tasks.length === 0 ? <EmptyState title="ไม่พบงานตรวจ" detail="ยังไม่มีงานตรวจในสิทธิ์ที่คุณเข้าถึงได้" /> : null}
      {!loading ? tasks.map((task) => <TaskCard key={task.id} task={task} canUpdate={isInspector || isStaffOrAdmin} updating={updatingId === task.id} onSelect={setSelectedTaskId} onUpdate={updateTaskStatus} />) : null}

      {selectedTask ? <TaskDetail task={selectedTask} note={resultNote} submitting={updatingId === selectedTask.id} onNoteChange={setResultNote} onSubmit={() => updateTaskStatus(selectedTask.id, selectedTask.result_status)} /> : null}

      {error ? <ErrorState title="เกิดข้อผิดพลาดในงานตรวจ" detail={error} /> : null}
      {message ? <p>{message}</p> : null}
    </MobileAppShell>
  );
}
