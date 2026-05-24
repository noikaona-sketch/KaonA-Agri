'use client';

import { useEffect, useMemo, useState } from 'react';

type Row = {
  id: string; full_name: string; phone: string | null; status: string;
  district: string | null; subdistrict: string | null; province: string | null;
  bank_name: string | null; bank_account_name: string | null; bank_account_number: string | null;
  citizen_id_masked: string | null; line_user_id: string | null;
  missingBank: boolean; missingLocation: boolean; missingPhone: boolean; missingDocs: boolean;
  duplicateWarning: boolean; readyToApprove: boolean; needsCorrection: boolean;
};

type Filter = 'imported_only'|'missing_bank'|'missing_location'|'missing_phone'|'missing_documents'|'duplicate_warning'|'ready_to_approve'|'needs_correction';

export function AdminImportReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>('imported_only');
  const [selected, setSelected] = useState<string[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    const res = await fetch(`/api/admin/members/import-review?filter=${filter}`);
    const data = await res.json();
    setRows(data.members ?? []);
    setSummary(data.summary ?? {});
  };

  useEffect(() => { void load(); }, [filter]);
  const allSelected = useMemo(() => rows.length > 0 && selected.length === rows.length, [rows, selected]);

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const saveEdit = async () => {
    if (!edit) return;
    await fetch(`/api/admin/members/import-review/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
    setEdit(null); await load();
  };

  return <div style={{ display: 'grid', gap: 12 }}>
    <h3 style={{ margin: 0 }}>🛠️ Import Review</h3>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span className="role-pill">missing bank: {summary.missing_bank ?? 0}</span>
      <span className="role-pill">missing location: {summary.missing_location ?? 0}</span>
      <span className="role-pill">duplicate warning: {summary.duplicate_warning ?? 0}</span>
      <span className="role-pill">ready: {summary.ready ?? 0}</span>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(['imported_only','missing_bank','missing_location','missing_phone','missing_documents','duplicate_warning','ready_to_approve','needs_correction'] as Filter[]).map((f) => <button key={f} className={`admin-btn ${filter===f?'admin-btn--primary':'admin-btn--secondary'}`} onClick={() => setFilter(f)}>{f}</button>)}
    </div>

    <div style={{ display: 'flex', gap: 8 }}>
      <button className="admin-btn admin-btn--secondary" onClick={async () => { await fetch('/api/admin/members/import-review', { credentials: 'include',  method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids:selected, action:'mark_needs_correction' })}); await load(); }}>mark needs correction</button>
      <button className="admin-btn admin-btn--secondary" onClick={() => window.open(`/api/admin/members/import-review?filter=${filter}&format=csv`, '_blank')}>export incomplete CSV</button>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="bulk status note" />
      <button className="admin-btn admin-btn--secondary" onClick={async () => { await fetch('/api/admin/members/import-review', { credentials: 'include',  method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids:selected, action:'bulk_status_note', note })}); }}>apply note</button>
    </div>

    <table className="admin-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}/></th><th>Name</th><th>Phone</th><th>Flags</th><th></th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></td><td>{r.full_name}</td><td>{r.phone ?? '—'}</td><td>{r.missingBank && '🏦'} {r.missingLocation && '📍'} {r.missingPhone && '📞'} {r.missingDocs && '📄'} {r.duplicateWarning && '⚠️'} {r.readyToApprove && '✅'}</td><td><button className="admin-btn admin-btn--ghost" onClick={() => setEdit(r)}>repair</button></td></tr>)}
    </tbody></table>

    {edit && <div style={{ border:'1px solid #ddd', padding:12, borderRadius:8, display:'grid', gap:6 }}>
      <b>Repair panel (safe edit only)</b>
      {(['full_name','phone','district','subdistrict','province','bank_name','bank_account_name','bank_account_number','citizen_id_masked','line_user_id'] as const).map((k) =>
        <input key={k} value={(edit[k] ?? '') as string} placeholder={k} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null } as Row)} />
      )}
      <div><button className="admin-btn admin-btn--primary" onClick={saveEdit}>save repair</button> <button className="admin-btn admin-btn--secondary" onClick={() => setEdit(null)}>cancel</button></div>
    </div>}
  </div>;
}
