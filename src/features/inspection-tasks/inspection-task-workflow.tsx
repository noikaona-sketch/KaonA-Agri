'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/shared/components/empty-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';

import { TaskCard } from './task-card';
import { TaskDetail } from './task-detail';
import type { InspectionTaskRow } from './types';

const MOCK_TASKS: InspectionTaskRow[] = [
  {
    id: 'task-001',
    no_burn_request_id: 'nbr-2026-0510-01',
    plot_id: 'plot-a1',
    inspector_member_id: 'inspector-demo',
    assigned_at: '2026-05-10T08:00:00.000Z',
    visited_at: null,
    result_status: 'assigned',
    result_note: null,
    created_at: '2026-05-10T07:30:00.000Z',
  },
  {
    id: 'task-002',
    no_burn_request_id: 'nbr-2026-0510-02',
    plot_id: 'plot-c3',
    inspector_member_id: 'inspector-demo',
    assigned_at: '2026-05-10T09:30:00.000Z',
    visited_at: null,
    result_status: 'pending',
    result_note: null,
    created_at: '2026-05-10T09:00:00.000Z',
  },
];

export function InspectionTaskWorkflow() {
  const [tasks] = useState<InspectionTaskRow[]>(MOCK_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(MOCK_TASKS[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<'all' | InspectionTaskRow['result_status']>('all');
  const [gpsChecked, setGpsChecked] = useState(false);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState(false);
  const [resultDraft, setResultDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);
  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((task) => task.result_status === statusFilter);
  }, [statusFilter, tasks]);

  function resetFlow() {
    setGpsChecked(false);
    setPhotoChecked(false);
    setChecklistChecked(false);
    setResultDraft('');
    setSubmitted(false);
  }

  return (
    <MobileAppShell title="งานตรวจแปลง (Prototype)" subtitle="UI Flow: รายการงาน → รายละเอียด → GPS → รูปหลักฐาน → เช็กลิสต์ → ส่งผล" roleBadge="inspector">
      <SectionHeader title="รายการงานตรวจ (Mock Data)" subtitle="Issue #115: UI-only prototype (ไม่เชื่อม DB / Auth / RLS / Backend)" />

      <label>
        กรองตามสถานะ
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">ทั้งหมด</option>
          <option value="pending">รอมอบหมาย</option>
          <option value="assigned">มอบหมายแล้ว</option>
          <option value="passed">ผ่าน</option>
          <option value="failed">ไม่ผ่าน</option>
          <option value="needs_update">ให้แก้ไข</option>
          <option value="completed">ปิดงานแล้ว</option>
        </select>
      </label>

      {filteredTasks.length === 0 ? <EmptyState title="ไม่พบงานตรวจ" detail="ไม่มีงานในสถานะที่เลือก (mock)" /> : null}
      {filteredTasks.map((task) => (
        <TaskCard key={task.id} task={task} onSelect={(id) => {
          setSelectedTaskId(id);
          resetFlow();
        }} selected={task.id === selectedTaskId} />
      ))}

      {selectedTask ? (
        <TaskDetail
          task={selectedTask}
          gpsChecked={gpsChecked}
          photoChecked={photoChecked}
          checklistChecked={checklistChecked}
          submitted={submitted}
          resultDraft={resultDraft}
          onGpsToggle={() => setGpsChecked((v) => !v)}
          onPhotoToggle={() => setPhotoChecked((v) => !v)}
          onChecklistToggle={() => setChecklistChecked((v) => !v)}
          onResultDraftChange={setResultDraft}
          onSubmit={() => setSubmitted(true)}
        />
      ) : null}
    </MobileAppShell>
  );
}
