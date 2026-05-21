'use client';

import { FormEvent, useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminApprovalQueue } from '@/features/admin-members/admin-approval-queue';
import { AdminMemberList } from '@/features/admin-members/admin-member-list';
import { AdminRolesManager } from '@/features/admin-roles/admin-roles-manager';
import { AdminGroups } from '@/features/admin-groups/admin-groups';
import { AdminCreatePin } from '@/features/admin-invites/admin-create-pin';

type Tab = 'approvals' | 'list' | 'roles' | 'groups' | 'pin' | 'import';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'approvals', icon: '✅', label: 'คิวอนุมัติ' },
  { key: 'list', icon: '👥', label: 'สมาชิกทั้งหมด' },
  { key: 'roles', icon: '🏷️', label: 'Role' },
  { key: 'groups', icon: '🗂️', label: 'กลุ่ม' },
  { key: 'pin', icon: '🔑', label: 'สร้าง PIN' },
  { key: 'import', icon: '📥', label: 'Import' },
];

type PreviewResponse = {
  ok: boolean;
  rows: Array<Record<string, unknown>>;
  errors: string[];
  warnings: string[];
  duplicateCandidates: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
};
 codex/add-csv/xlsx-preview-parser-for-imports-xwkd0o
type ConfirmResponse = {
  ok: boolean;
  insertedCount: number;
  blockedCount: number;
  duplicateBlockCount: number;
  errors: string[];
  warnings?: string[];
};



export default function AdminMembersPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmOverrideDuplicate, setConfirmOverrideDuplicate] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResponse | null>(null);


  const cur = TABS.find((t) => t.key === tab)!;

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setRequestError('กรุณาเลือกไฟล์ก่อน preview');
      return;
    }
    setLoadingPreview(true);
    setRequestError(null);
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/admin/members/import/preview', { method: 'POST', body: form });
      const data = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setRequestError(data.error ?? data.errors?.[0] ?? 'preview ไม่สำเร็จ');
      }
      setPreview(data);
      setConfirmResult(null);


    } catch {
      setRequestError('เกิดข้อผิดพลาดเครือข่ายระหว่าง preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const onConfirmImport = async () => {
    if (!preview?.rows?.length) return;
    setConfirming(true);
    setRequestError(null);
    setConfirmResult(null);
    try {
      const res = await fetch('/api/admin/members/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: preview.rows,
          overrideDuplicate: confirmOverrideDuplicate,
          importNote: 'Admin import confirm from preview UI',
        }),
      });
      const data = (await res.json()) as ConfirmResponse & { error?: string };
      if (!res.ok) setRequestError(data.error ?? data.errors?.[0] ?? 'confirm import ไม่สำเร็จ');
      setConfirmResult(data);
    } catch {
      setRequestError('เกิดข้อผิดพลาดเครือข่ายระหว่าง confirm import');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AdminWebShell title={`${cur.icon} ${cur.label}`} subtitle="จัดการสมาชิก สิทธิ์ กลุ่ม และ PIN">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`} style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'approvals' && <AdminApprovalQueue />}
      {tab === 'list' && <AdminMemberList />}
      {tab === 'roles' && <AdminRolesManager />}
      {tab === 'groups' && <AdminGroups />}
      {tab === 'pin' && <AdminCreatePin />}
      {tab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>📥 Import สมาชิก (Preview Only)</h3>
          <a href="/api/admin/members/import-template" download className="admin-btn admin-btn--secondary" style={{ width: 'fit-content' }}>📄 ดาวน์โหลด Template (.xlsx)</a>
          <form onSubmit={onPreview} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".csv,.xlsx" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} />
            <button type="submit" className="admin-btn admin-btn--primary" disabled={loadingPreview}>{loadingPreview ? 'กำลัง preview...' : 'Preview'}</button>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              disabled={confirming || !preview?.ok || (preview?.errors?.length ?? 0) > 0}
              onClick={onConfirmImport}
              title={!preview?.ok ? 'preview ต้องผ่านก่อน' : ''}
            >
              {confirming ? 'กำลังยืนยัน...' : 'Confirm Import'}
            </button>
          </form>
          <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmOverrideDuplicate} onChange={(e) => setConfirmOverrideDuplicate(e.target.checked)} />
            อนุญาต override duplicates (ต้องเปิดเมื่อระบบแจ้ง duplicate)
          </label>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            ⚠️ Import นี้ไม่มี auto approve และสมาชิกที่ import จะเข้า pending approval เท่านั้น
          </div>

          {requestError && <div style={{ color: '#b91c1c', fontSize: 13 }}>{requestError}</div>}

            <button type="button" className="admin-btn admin-btn--secondary" disabled title="coming next PR">Confirm Import (coming next PR)</button>
          </form>

          {requestError && <div style={{ color: '#b91c1c', fontSize: 13 }}>{requestError}</div>}

          {preview && (
            <>
              <pre style={{ margin: 0, background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}>summary: {JSON.stringify(preview.summary ?? {}, null, 2)}</pre>
              {preview.errors?.length > 0 && <div style={{ color: '#b91c1c', fontSize: 13 }}>Errors: {preview.errors.join(' | ')}</div>}
              {preview.warnings?.length > 0 && <div style={{ color: '#b45309', fontSize: 13 }}>Warnings: {preview.warnings.join(' | ')}</div>}
              {preview.duplicateCandidates?.length > 0 && <pre style={{ margin: 0, background: '#fff7ed', padding: 10, borderRadius: 8, border: '1px solid #fed7aa', fontSize: 12 }}>duplicateCandidates: {JSON.stringify(preview.duplicateCandidates, null, 2)}</pre>}

              {confirmResult && (
                <pre style={{ margin: 0, background: '#ecfdf5', padding: 10, borderRadius: 8, border: '1px solid #a7f3d0', fontSize: 12 }}>
                  confirmResult: {JSON.stringify(confirmResult, null, 2)}
                </pre>
              )}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Row</th><th>Full name</th><th>Phone</th><th>CID masked</th><th>District</th><th>Province</th></tr></thead>
                  <tbody>
                    {preview.rows?.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af' }}>ไม่มีข้อมูล</td></tr>}
                    {preview.rows?.map((r, idx) => (
                      <tr key={idx}>
                        <td>{String(r.rowNumber ?? '')}</td><td>{String(r.full_name ?? '')}</td><td>{String(r.phone ?? '')}</td><td>{String(r.citizen_id_masked ?? '')}</td><td>{String(r.district ?? '')}</td><td>{String(r.province ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </AdminWebShell>
  );
}
